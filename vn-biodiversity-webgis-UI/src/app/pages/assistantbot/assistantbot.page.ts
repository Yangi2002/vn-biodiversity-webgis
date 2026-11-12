import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SiteHeaderComponent } from '../../shared/components/site-header/site-header.component';
import { HttpApiService } from '../../core/api/http-api.service';
import { AdminAuthService } from '../../data-access/services/auth/admin-auth.service';
interface Answer {
  answer: string;
  model_version: string;
  finish_reason: string;
  citations: { number: number; title: string; url: string | null }[];
  media: { url: string; type: string; source_number: number }[];
}
interface Turn {
  question: string;
  result?: Answer;
  error?: string;
}
@Component({
  selector: 'app-ai-page',
  imports: [FormsModule, RouterLink, SiteHeaderComponent],
  template: `
    <app-site-header sectionLabel="Chế độ AI" />
    <main>
      <header>
        <div>
          <img src="/Header-logo-header.png" width="48" height="48" alt="" />
          <h1>STACBOT-1.0</h1>
          <p>Sinh thái & đa dạng sinh học</p>
        </div>
        <button (click)="clear()" [disabled]="busy() || !turns().length">
          Cuộc trò chuyện mới
        </button>
      </header>
      <section aria-label="Cuộc trò chuyện" aria-live="polite" [attr.aria-busy]="busy()">
        @if (!turns().length) {
          <div class="empty"><h2>Bạn muốn tìm hiểu loài nào?</h2></div>
        }
        @for (turn of turns(); track $index) {
          <article>
            <strong>Bạn</strong>
            <p>{{ turn.question }}</p>
            @if (turn.result; as result) {
              <div class="answer">
                <strong>STACBOT · v{{ result.model_version }}</strong>
                <p>{{ result.answer }}</p>
                @if (result.finish_reason === 'token_limit') {
                  <p>Phản hồi đã chạm giới hạn độ dài.</p>
                }
                @if (result.citations.length) {
                  <h3>Nguồn trích dẫn</h3>
                  <ul>
                    @for (source of result.citations; track source.number) {
                      <li>
                        @if (safeUrl(source.url); as url) {
                          <a [href]="url" target="_blank" rel="noopener noreferrer"
                            >[{{ source.number }}] {{ source.title }}</a
                          >
                        } @else {
                          <span>[{{ source.number }}] {{ source.title }}</span>
                        }
                      </li>
                    }
                  </ul>
                }
                <div class="media">
                  @for (item of result.media; track $index) {
                    @if (safeUrl(item.url); as url) {
                      <figure>
                        @if (item.type === 'image') {
                          <img
                            [src]="url"
                            alt="Media từ nguồn trích dẫn"
                            loading="lazy"
                            referrerpolicy="no-referrer"
                          />
                        }
                        <figcaption>
                          <a [href]="url" target="_blank" rel="noopener noreferrer"
                            >{{ item.type }} · Nguồn [{{ item.source_number }}]</a
                          >
                        </figcaption>
                      </figure>
                    }
                  }
                </div>
              </div>
            } @else if (turn.error) {
              <div role="alert">
                <p>{{ turn.error }}</p>
                <button (click)="send(turn.question)" [disabled]="busy()">Thử lại</button>
              </div>
            } @else {
              <p role="status">Đang tìm nguồn và tạo phản hồi…</p>
            }
          </article>
        }
      </section>
      <footer>
        @if (auth.isAuthenticated()) {
          <form (ngSubmit)="send()">
            <label for="question">Câu hỏi</label
            ><textarea
              id="question"
              name="question"
              [(ngModel)]="question"
              maxlength="2000"
              rows="3"
              placeholder="Hỏi về loài, phân bố hoặc bảo tồn…"
              [disabled]="busy()"
            ></textarea>
            <div class="actions">
              <small>{{ question.length }}/2000</small
              ><button type="submit" [disabled]="busy() || !question.trim()">Gửi câu hỏi</button>
            </div>
          </form>
        } @else {
          <p>Đăng nhập để hỏi STACBOT.</p>
          <a routerLink="/login" [queryParams]="{ returnUrl: '/ai' }">Đăng nhập</a>
        }
      </footer>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: #f5f7f6;
      color: #17251f;
    }
    main {
      max-width: 1040px;
      margin: auto;
      padding: 24px;
    }
    header,
    .actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    header {
      padding-bottom: 22px;
      border-bottom: 1px solid #d9e1dc;
    }
    header img {
      float: left;
      margin-right: 16px;
    }
    h1 {
      font-size: 24px;
      margin: 0;
    }
    h2 {
      font-size: 24px;
    }
    h3 {
      font-size: 14px;
    }
    header p {
      margin: 4px 0;
      color: #53635b;
    }
    button {
      border: 1px solid #19764d;
      border-radius: 6px;
      padding: 10px 16px;
      background: #19764d;
      color: white;
      font: inherit;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    button:focus-visible,
    a:focus-visible,
    textarea:focus-visible {
      outline: 3px solid #b37c19;
      outline-offset: 3px;
    }
    header button {
      background: transparent;
      color: #19764d;
    }
    section {
      min-height: 300px;
    }
    .empty {
      padding: 70px 16px;
      text-align: center;
    }
    article {
      padding: 24px 0;
      border-bottom: 1px solid #d9e1dc;
    }
    .answer {
      margin-top: 24px;
      border-left: 3px solid #19764d;
      padding-left: 16px;
    }
    p {
      line-height: 1.7;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    a {
      color: #176c91;
      overflow-wrap: anywhere;
    }
    li {
      margin: 10px 0;
    }
    small {
      color: #617369;
    }
    footer {
      padding: 24px 0;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
    }
    textarea {
      width: 100%;
      box-sizing: border-box;
      resize: vertical;
      min-height: 96px;
      max-height: 260px;
      border: 1px solid #adbbb2;
      border-radius: 6px;
      padding: 14px;
      font: inherit;
      background: white;
    }
    .actions {
      margin-top: 10px;
    }
    .media {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
    }
    figure {
      margin: 0;
      min-width: 0;
    }
    figure img {
      width: 100%;
      aspect-ratio: 4/3;
      object-fit: contain;
      background: #e9eeeb;
    }
    figcaption {
      font-size: 13px;
      padding: 8px 0;
    }
    @media (max-width: 600px) {
      main {
        padding: 16px;
      }
      h1,
      h2 {
        font-size: 21px;
      }
      .empty {
        padding: 40px 0;
      }
    }
  `,
})
export class AssistantBotPage {
  protected readonly auth = inject(AdminAuthService);
  private readonly api = inject(HttpApiService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly turns = signal<Turn[]>([]);
  protected readonly busy = signal(false);
  protected question = '';
  protected safeUrl(value: string | null): string | null {
    try {
      return value && ['http:', 'https:'].includes(new URL(value).protocol) ? value : null;
    } catch {
      return null;
    }
  }
  protected clear(): void {
    if (!this.busy()) this.turns.set([]);
  }
  protected send(value = this.question): void {
    const question = value.trim();
    if (!question || question.length > 2000 || this.busy() || !this.auth.isAuthenticated()) return;
    this.question = '';
    this.busy.set(true);
    const index = this.turns().length;
    this.turns.update((items) => [...items, { question }]);
    const update = (patch: Partial<Turn>) =>
      this.turns.update((items) =>
        items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
      );
    this.api
      .post<Answer>('assistant-bot/answer', { question })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          update({ result });
          this.busy.set(false);
        },
        error: (error) => {
          update({
            error:
              error.status === 401
                ? 'Phiên đăng nhập đã hết hạn.'
                : error.status === 429
                  ? 'Model đang xử lý câu hỏi trước. Vui lòng chờ rồi thử lại.'
                  : error.status === 504
                    ? 'Model đã hết thời gian xử lý. Hãy thử câu hỏi ngắn hơn, không gửi lại liên tục.'
                : 'Chưa nhận được phản hồi. Kiểm tra dịch vụ AI rồi thử lại.',
          });
          this.busy.set(false);
        },
      });
  }
}
