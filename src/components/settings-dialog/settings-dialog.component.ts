import { ChangeDetectionStrategy, Component, computed, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-settings-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="modal"
      tabindex="-1"
      data-cursor-pointer
      [style.backgroundColor]="themeService.scrimColor()"
      (click)="close.emit()"
    >
      <article
        class="modal__panel modal__panel--medium animate-slide-up settings-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        [style.--modal-surface]="themeService.dialogPalette().surface"
        [style.--modal-border]="themeService.dialogPalette().border"
        [style.--modal-text]="themeService.dialogPalette().text"
        [style.--modal-title]="themeService.dialogPalette().title"
        [style.--modal-muted]="themeService.dialogPalette().muted"
        [style.--modal-icon]="themeService.dialogPalette().icon"
        [style.--input-background]="themeService.dialogPalette().inputBackground"
        [style.--input-text]="themeService.dialogPalette().inputText"
        [style.--input-border]="themeService.dialogPalette().inputBorder"
        [style.--input-focus-ring]="themeService.dialogPalette().focusRing"
        [style.--btn-primary-bg]="themeService.dialogPalette().buttonPrimaryBg"
        [style.--btn-primary-text]="themeService.dialogPalette().buttonPrimaryText"
        [style.--btn-secondary-bg]="themeService.dialogPalette().buttonSecondaryBg"
        [style.--btn-secondary-text]="themeService.dialogPalette().buttonSecondaryText"
        [style.--btn-danger-bg]="themeService.dialogPalette().buttonDangerBg"
        [style.--btn-danger-text]="themeService.dialogPalette().buttonDangerText"
        (click)="$event.stopPropagation()"
      >
        <header class="modal__header">
          <div class="settings-dialog__title-wrapper">
            <p class="settings-dialog__eyebrow">Configurações</p>
            <h2 id="settings-dialog-title" class="modal__title">Gerenciar conta</h2>
          </div>
          <button
            type="button"
            class="btn btn--ghost btn--icon modal__close"
            aria-label="Fechar"
            data-cursor-pointer
            (click)="close.emit()"
          >
            &times;
          </button>
        </header>

        <section class="modal__body settings-dialog__body">
          <article class="settings-dialog__card" role="group" aria-labelledby="account-deletion-title">
            <div class="settings-dialog__card-header">
              <div>
                <p class="settings-dialog__eyebrow">Conta</p>
                <h3 id="account-deletion-title" class="settings-dialog__card-title">Excluir conta</h3>
              </div>
              <span class="settings-dialog__badge">Ação irreversível</span>
            </div>

            <p class="settings-dialog__description">
              Esta ação remove definitivamente seus dados e galerias sincronizadas. As imagens armazenadas serão apagadas do
              servidor e do seu navegador. Certifique-se de exportar qualquer conteúdo que deseje manter.
            </p>

            <ul class="settings-dialog__list">
              <li>Suas galerias e fotos serão removidas do Supabase.</li>
              <li>Uploads pendentes e cache local serão descartados.</li>
              <li>Você será desconectado imediatamente após a confirmação.</li>
            </ul>

            <div class="settings-dialog__confirmations" aria-live="polite">
              <label class="settings-dialog__checkbox">
                <input
                  type="checkbox"
                  [checked]="acknowledgeIrreversibility()"
                  (change)="acknowledgeIrreversibility.set(($event.target as HTMLInputElement).checked)"
                />
                <span>Entendo que esta ação não pode ser desfeita.</span>
              </label>

              <label class="settings-dialog__input">
                <span class="settings-dialog__input-label">Digite "DELETAR" para confirmar</span>
                <input
                  type="text"
                  class="form-field__input settings-dialog__text-input"
                  placeholder="DELETAR"
                  autocomplete="off"
                  [value]="confirmationPhrase()"
                  (input)="confirmationPhrase.set(($event.target as HTMLInputElement).value)"
                />
              </label>
            </div>

            @if (error()) {
              <div class="alert alert--danger settings-dialog__alert">
                {{ error() }}
              </div>
            }
          </article>
        </section>

        <footer class="modal__footer modal__footer--split">
          <div class="settings-dialog__footer-copy">
            <p class="settings-dialog__helper">Após a exclusão você será redirecionado para a área pública.</p>
          </div>
          <div class="modal__footer-group">
            <button type="button" class="btn btn--secondary" data-cursor-pointer (click)="close.emit()">
              Cancelar
            </button>
            <button
              type="button"
              class="btn btn--danger"
              data-cursor-pointer
              [disabled]="isDeletionDisabled()"
              (click)="submitDeletion()"
            >
              @if (isDeleting()) { Excluindo... } @else { Excluir conta }
            </button>
          </div>
        </footer>
      </article>
    </div>
  `,
  styles: `
    .settings-dialog__panel {
      gap: 1rem;
    }

    .settings-dialog__title-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .settings-dialog__eyebrow {
      margin: 0;
      font-size: 0.8rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--modal-muted, var(--dialog-muted));
    }

    .settings-dialog__body {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .settings-dialog__card {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.25rem;
      border: 1px solid var(--modal-border, var(--dialog-border));
      border-radius: 0.75rem;
      background: var(--modal-surface, var(--dialog-surface));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    .settings-dialog__card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .settings-dialog__card-title {
      margin: 0;
      font-size: 1.1rem;
      letter-spacing: 0.04em;
    }

    .settings-dialog__badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      background: rgba(248, 113, 113, 0.12);
      color: #ef4444;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-size: 0.75rem;
    }

    .settings-dialog__description {
      margin: 0;
      color: var(--modal-text, var(--dialog-text));
      line-height: 1.6;
    }

    .settings-dialog__list {
      margin: 0;
      padding-left: 1.25rem;
      display: grid;
      gap: 0.4rem;
      color: var(--modal-muted, var(--dialog-muted));
    }

    .settings-dialog__confirmations {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      border-radius: 0.75rem;
      border: 1px dashed var(--modal-border, var(--dialog-border));
      background: var(--modal-header-surface, rgba(0,0,0,0.02));
    }

    .settings-dialog__checkbox {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.5rem;
      align-items: center;
      color: var(--modal-text, var(--dialog-text));
      font-weight: 600;
    }

    .settings-dialog__checkbox input {
      width: 1rem;
      height: 1rem;
    }

    .settings-dialog__input {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .settings-dialog__input-label {
      font-size: 0.85rem;
      letter-spacing: 0.04em;
      color: var(--modal-muted, var(--dialog-muted));
    }

    .settings-dialog__text-input {
      width: 100%;
    }

    .settings-dialog__alert {
      margin: 0.25rem 0 0;
    }

    .settings-dialog__footer-copy {
      max-width: 20rem;
    }

    .settings-dialog__helper {
      margin: 0;
      color: var(--modal-muted, var(--dialog-muted));
      font-size: 0.9rem;
    }

    @media (max-width: 600px) {
      .settings-dialog__card {
        padding: 1rem;
      }

      .settings-dialog__card-header {
        align-items: flex-start;
        flex-direction: column;
      }

      .settings-dialog__footer-copy {
        display: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDialogComponent {
  close = output<void>();
  confirmDelete = output<void>();

  isDeleting = input(false);
  error = input<string | null>(null);

  acknowledgeIrreversibility = signal(false);
  confirmationPhrase = signal('');

  protected readonly themeService = inject(ThemeService);

  isDeletionDisabled = computed(() => {
    if (this.isDeleting()) {
      return true;
    }

    const phrase = this.confirmationPhrase().trim().toUpperCase();
    return !this.acknowledgeIrreversibility() || phrase !== 'DELETAR';
  });

  submitDeletion(): void {
    if (this.isDeletionDisabled()) {
      return;
    }

    this.confirmDelete.emit();
  }
}
