"""Explicit local startup; invoked only by the operator."""

import argparse
import os
from pathlib import Path

from biodiversity_ai.assistant.dataset_build import load_env_file


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--env-file', type=Path, required=True)
    parser.add_argument('--release', type=Path, required=True)
    parser.add_argument('--adapter', type=Path, required=True)
    parser.add_argument('--base', type=Path, required=True)
    parser.add_argument('--embedding', type=Path, required=True)
    parser.add_argument('--partition', choices=['all', 'train', 'validation', 'test'], default='all',
                        help='Serving defaults to all corpus partitions; not an evaluation score.')
    parser.add_argument('--device', choices=['cpu', 'cuda'], default='cpu')
    parser.add_argument('--port', type=int, default=8001)
    args = parser.parse_args()
    load_env_file(args.env_file)
    for key, value in {
        'STAC_RELEASE_DIR': args.release, 'STAC_ADAPTER_DIR': args.adapter,
        'STAC_BASE_MODEL_DIR': args.base, 'STAC_EMBEDDING_MODEL_DIR': args.embedding,
    }.items():
        if not value.is_dir():
            raise ValueError(f'Missing directory: {value}')
        os.environ[key] = str(value.resolve())
    os.environ['STAC_CORPUS_PARTITION'] = args.partition
    os.environ['STAC_DEVICE'] = args.device
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    import uvicorn
    uvicorn.run('biodiversity_ai.assistant.serving:app', host='127.0.0.1', port=args.port, workers=1)


if __name__ == '__main__':
    main()
