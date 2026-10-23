"""Open-weight causal language model adapter for grounded generation."""

from __future__ import annotations

from typing import Protocol


class TextGenerator(Protocol):
    def generate(self, prompt: str) -> str: ...


class TransformersGenerator:
    """Lazy local generator; no remote commercial model API is used."""

    def __init__(
        self,
        model_name: str,
        *,
        max_new_tokens: int = 384,
        device_map: str = "auto",
    ) -> None:
        self.model_name = model_name
        self.max_new_tokens = max_new_tokens
        self.device_map = device_map
        self._model: object | None = None
        self._tokenizer: object | None = None

    def generate(self, prompt: str) -> str:
        model, tokenizer = self._load()
        rendered_prompt = prompt
        apply_chat_template = getattr(tokenizer, "apply_chat_template", None)
        if callable(apply_chat_template):
            rendered_prompt = apply_chat_template(
                [{"role": "user", "content": prompt}],
                tokenize=False,
                add_generation_prompt=True,
            )
        inputs = tokenizer(rendered_prompt, return_tensors="pt")  # type: ignore[operator]
        device = getattr(model, "device", None)
        if device is not None:
            inputs = {key: value.to(device) for key, value in inputs.items()}
        output = model.generate(  # type: ignore[attr-defined]
            **inputs,
            max_new_tokens=self.max_new_tokens,
            do_sample=False,
            pad_token_id=tokenizer.eos_token_id,  # type: ignore[attr-defined]
        )
        prompt_length = inputs["input_ids"].shape[-1]
        return tokenizer.decode(  # type: ignore[attr-defined]
            output[0][prompt_length:],
            skip_special_tokens=True,
        ).strip()

    def _load(self) -> tuple[object, object]:
        if self._model is None or self._tokenizer is None:
            try:
                from transformers import AutoModelForCausalLM, AutoTokenizer
            except ImportError as error:
                raise RuntimeError(
                    "Generation requires the optional 'rag' dependencies."
                ) from error
            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self._model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                device_map=self.device_map,
                torch_dtype="auto",
            )
        return self._model, self._tokenizer

