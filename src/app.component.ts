import { Component, ChangeDetectionStrategy, signal, inject, computed, effect, viewChild, ElementRef, OnInit, AfterViewInit, OnDestroy, NgZone, HostListener, HostBinding, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GalleryService } from './services/gallery.service';
import { ContextMenuComponent } from './components/context-menu/context-menu.component';
import { WebcamCaptureComponent } from './components/webcam-capture/webcam-capture.component';
import { GalleryEditorComponent } from './components/gallery-editor/gallery-editor.component';
import { GalleryCreationDialogComponent } from './components/gallery-creation-dialog/gallery-creation-dialog.component';
import { InfoDialogComponent } from './components/info-dialog/info-dialog.component';
import { MobileGalleryCardComponent } from './components/mobile-gallery-card/mobile-gallery-card.component';
import { SettingsDialogComponent } from './components/settings-dialog/settings-dialog.component';

import { Gallery } from './interfaces/gallery.interface';
import { InteractiveCursor } from './services/interactive-cursor';
import { ThemeService } from './services/theme.service';
import { AuthService, SupabaseAuthSubscription, SupabaseClientLike } from './services/auth.service';
import { SupabaseAuthClientService } from './services/supabase-auth-client.service';
import { PermissionsService } from './services/permissions.service';
import { ContextMenuAction, ContextMenuGroup } from './types/context-menu';

// Interfaces para tipagem dos dados
interface BaseItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  col: number;
  row: number;
  creationOrder: number;
}

interface PhotoItem extends BaseItem {
  type: 'photo';
  url: string;
}

interface GalleryCardItem extends BaseItem {
  type: 'gallery';
  name: string;
  description: string;
  thumbnailUrl: string;
  imageUrls: string[];
  imageCount: number;
  createdAt?: string;
  previewKey: string;
}

type VisibleItem = PhotoItem | GalleryCardItem;

const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
type ArrowKey = (typeof ARROW_KEYS)[number];

const FALLBACK_GALLERY_THUMBNAIL =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 200'><rect width='300' height='200' fill='%23111111'/></svg>";

const HOP_EASING = 'cubic-bezier(0.9, 0, 0.1, 1)';

function isArrowKey(key: string): key is ArrowKey {
  return (ARROW_KEYS as readonly string[]).includes(key);
}

interface ExpandedItem {
  id: string;
  url:string;
  originalRect: DOMRect;
  originalWidth: number;
  originalHeight: number;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, ContextMenuComponent, WebcamCaptureComponent, GalleryEditorComponent, GalleryCreationDialogComponent, InfoDialogComponent, SettingsDialogComponent, MobileGalleryCardComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @HostBinding('style.background-color')
  get hostBackgroundColor(): string {
    return this.themeService.bodyBackground();
  }

  @HostBinding('style.color')
  get hostTextColor(): string {
    return this.themeService.bodyText();
  }

  @HostListener('document:keydown.space', ['$event'])
  handleSpacebar(event?: KeyboardEvent | MouseEvent): void {
    if (event instanceof KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (this.isTypingElement(target) || this.currentView() !== 'photos') {
        return;
      }

      event.preventDefault();
    }

    if (this.currentView() !== 'photos') {
      return;
    }

    if (
      this.isWebcamVisible() ||
      this.expandedItem() ||
      this.isGalleryEditorVisible() ||
      this.isGalleryCreationDialogVisible()
    ) {
      return;
    }

    const captureGalleryId = this.resolveCaptureTargetGallery();
    if (!captureGalleryId) {
      return;
    }

    this.galleryService.selectGallery(captureGalleryId);
    this.openWebcamCapture();
  }

  @HostListener('document:keydown.g', ['$event'])
  handleCreateGalleryShortcut(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.isTypingElement(target) || this.currentView() !== 'galleries') {
      return;
    }

    if (!this.canCreateGalleries()) {
      return;
    }

    if (
      this.isWebcamVisible() ||
      this.expandedItem() ||
      this.isGalleryEditorVisible() ||
      this.isGalleryCreationDialogVisible()
    ) {
      return;
    }

    event.preventDefault();
    this.openGalleryCreationDialog();
  }

  @HostListener('document:keydown.f', ['$event'])
  toggleFullscreenKey(event: KeyboardEvent): void {
    // Check if user is typing in an input field, textarea, or contenteditable element
    const target = event.target as HTMLElement;
    const isTyping = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.closest('input') ||
      target.closest('textarea')
    );

    if (isTyping) {
      // Allow 'f' to be typed normally in input fields
      return;
    }

    // Allow fullscreen toggle when info dialog is visible or when can drag
    if (this.isInteractionEnabled() || this.isInfoDialogVisible()) {
      event.preventDefault();
      this.toggleFullscreen();
    }
  }

  @HostListener('document:keydown.i', ['$event'])
  handleIKey(event: KeyboardEvent): void {
    // Check if user is typing in an input field, textarea, or contenteditable element
    const target = event.target as HTMLElement;
    const isTyping = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.closest('input') ||
      target.closest('textarea')
    );

    if (isTyping) {
      // Allow 'i' to be typed normally in input fields
      return;
    }

    event.preventDefault();
    // Toggle info dialog - if already open, it will close; if closed, it will open
    this.toggleInfoDialog();
  }

  @HostListener('document:keydown.q', ['$event'])
  handleQuitGalleryKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isTyping = !!target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      !!target.closest('input') ||
      !!target.closest('textarea')
    );

    if (isTyping) {
      return;
    }

    if (
      this.currentView() === 'photos' &&
      !this.expandedItem() &&
      !this.isGalleryEditorVisible() &&
      !this.isGalleryCreationDialogVisible() &&
      !this.isWebcamVisible()
    ) {
      event.preventDefault();
      this.backToGalleries();
    }
  }

  @HostListener('document:keydown.p', ['$event'])
  handlePKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.isTypingElement(target)) {
      return;
    }

    event.preventDefault();
    this.toggleAutoNavigation();
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.isTypingElement(target)) {
      return;
    }

    if (
      !this.expandedItem() &&
      !this.isWebcamVisible() &&
      !this.isGalleryEditorVisible() &&
      !this.isGalleryCreationDialogVisible() &&
      !this.isInfoDialogVisible() &&
      !this.contextMenu().visible &&
      !document.fullscreenElement
    ) {
      return;
    }

    event.preventDefault();

    if (this.expandedItem()) {
      this.closeExpandedItem();
      return;
    }

    if (this.isWebcamVisible()) {
      this.isWebcamVisible.set(false);
      return;
    }

    if (this.isGalleryEditorVisible()) {
      this.isGalleryEditorVisible.set(false);
      this.editingGallery.set(null);
      return;
    }

    if (this.isGalleryCreationDialogVisible()) {
      this.isGalleryCreationDialogVisible.set(false);
      return;
    }

    if (this.isInfoDialogVisible()) {
      this.isInfoDialogVisible.set(false);
      return;
    }

    if (this.contextMenu().visible) {
      this.closeContextMenu();
      return;
    }

    if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      document.exitFullscreen().catch(err => {
        console.error('Erro ao sair da tela cheia:', err);
      });
    }
  }

  toggleAutoNavigation(): void {
    if (this.currentView() !== 'galleries') {
      return;
    }

    if (this.autoNavigationCountdown() !== null) {
      this.cancelAutoNavigationCountdown();
      this.resetInactivityTimer();
      return;
    }

    if (this.isAutoNavigationActive()) {
      this.deactivateAutoNavigation();
      return;
    }

    if (!this.hasVisibleGalleries()) {
      return;
    }

    this.startAutoNavigationCountdown();
  }

  private isAutoNavigationSequenceActive(): boolean {
    return this.autoNavigationCountdown() !== null || this.isAutoNavigationActive();
  }

  private startAutoNavigationCountdown(): void {
    this.cancelAutoNavigationCountdown();

    if (!this.hasVisibleGalleries()) {
      this.resetInactivityTimer();
      return;
    }

    let remaining = this.AUTO_NAVIGATION_COUNTDOWN_DURATION;
    this.autoNavigationCountdown.set(remaining);
    this.autoNavigationCountdownIntervalId = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        this.ngZone.run(() => this.autoNavigationCountdown.set(remaining));
        return;
      }

      if (this.autoNavigationCountdownIntervalId) {
        clearInterval(this.autoNavigationCountdownIntervalId);
        this.autoNavigationCountdownIntervalId = null;
      }

      this.ngZone.run(() => {
        this.autoNavigationCountdown.set(null);
        this.activateAutoNavigation();
      });
    }, 1000);
  }

  private cancelAutoNavigationCountdown(): void {
    if (this.autoNavigationCountdownIntervalId) {
      clearInterval(this.autoNavigationCountdownIntervalId);
      this.autoNavigationCountdownIntervalId = null;
    }
    this.autoNavigationCountdown.set(null);
  }

  private activateAutoNavigation(): void {
    if (!this.hasVisibleGalleries()) {
      return;
    }

    if (this.inactivityTimeoutId) {
      clearTimeout(this.inactivityTimeoutId);
      this.inactivityTimeoutId = null;
    }

    this.configureIdleEllipse();
    this.stopAllGalleryPreviews();
    this.isAutoNavigationActive.set(true);
    this.isIdle.set(true);
    this.showAutoNavigationHint();
  }

  private deactivateAutoNavigation(silent: boolean = false): void {
    if (!this.isAutoNavigationActive()) {
      this.cancelAutoNavigationCountdown();
      return;
    }

    this.isAutoNavigationActive.set(false);
    this.exitIdleMode();
    this.cancelAutoNavigationCountdown();
    this.hideAutoNavigationHint();

    if (!silent) {
      this.resetInactivityTimer();
    }
  }

  private showAutoNavigationHint(): void {
    if (this.autoNavigationHintTimeoutId) {
      clearTimeout(this.autoNavigationHintTimeoutId);
    }

    this.autoNavigationHintVisible.set(true);
    this.autoNavigationHintTimeoutId = setTimeout(() => {
      this.autoNavigationHintTimeoutId = null;
      this.ngZone.run(() => this.autoNavigationHintVisible.set(false));
    }, this.AUTO_NAVIGATION_HINT_DURATION);
  }

  private hideAutoNavigationHint(): void {
    if (this.autoNavigationHintTimeoutId) {
      clearTimeout(this.autoNavigationHintTimeoutId);
      this.autoNavigationHintTimeoutId = null;
    }

    this.autoNavigationHintVisible.set(false);
  }

  private getVisibleGalleryItems(): GalleryCardItem[] {
    return this.visibleItems().filter((item): item is GalleryCardItem => item.type === 'gallery');
  }

  private hasVisibleGalleries(): boolean {
    return this.getVisibleGalleryItems().length > 0;
  }

  @HostListener('document:keydown.t', ['$event'])
  handleThemeKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.isTypingElement(target)) {
      return;
    }

    event.preventDefault();
    this.toggleThemeMode();
  }

  @HostListener('document:keydown', ['$event'])
  @HostListener('window:keydown', ['$event'])
  handleAdminAccessShortcut(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;

    // Se já está logado como admin, o diálogo de login está aberto
    // ou a pessoa está digitando em algum campo, não faz nada
    if (this.isLoginDialogVisible() || this.isAuthenticated() || this.isTypingElement(target)) {
      return;
    }

    const key = event.key.toLowerCase();

    // Atalho: apenas tecla "n" sem Ctrl/Alt/Meta
    if (!event.ctrlKey && !event.altKey && !event.metaKey && key === 'n') {
      event.preventDefault();
      this.openLoginDialog();
    }
  }

  toggleThemeMode(): void {
    this.themeService.toggleTheme();
  }

  openLoginDialog(): void {
    if (this.isLoginDialogVisible()) {
      return;
    }

    if (this.isSignUpDialogVisible()) {
      this.isSignUpDialogVisible.set(false);
    }

    this.loginError.set(null);
    if (!this.loginEmail()) {
      const email = this.authUserEmail();
      if (email) {
        this.loginEmail.set(email);
      }
    }

    this.isLoginDialogVisible.set(true);
  }

  closeLoginDialog(): void {
    if (this.isLoginInProgress()) {
      return;
    }

    this.isLoginDialogVisible.set(false);
  }

  async submitLogin(): Promise<void> {
    if (this.isLoginInProgress()) {
      return;
    }

    this.isLoginInProgress.set(true);
    this.loginError.set(null);

    try {
      const result = await this.authService.signIn(this.loginEmail(), this.loginPassword());

      if (result.error) {
        this.loginError.set(result.error);
        return;
      }

      await this.galleryService.initialize();
      this.hasInitializedView.set(false);
      this.isLoginDialogVisible.set(false);
      this.loginPassword.set('');
    } finally {
      this.isLoginInProgress.set(false);
    }
  }

  openSignUpDialog(): void {
    if (this.isSignUpDialogVisible()) {
      return;
    }

    this.signUpError.set(null);
    this.signUpPassword.set('');
    this.signUpConfirmPassword.set('');

    if (!this.signUpEmail()) {
      const email = this.authUserEmail() ?? this.loginEmail();
      if (email) {
        this.signUpEmail.set(email);
      }
    }

    if (this.isLoginDialogVisible()) {
      this.isLoginDialogVisible.set(false);
    }

    this.isSignUpDialogVisible.set(true);
  }

  closeSignUpDialog(): void {
    if (this.isSignUpInProgress()) {
      return;
    }

    this.isSignUpDialogVisible.set(false);
  }

  async submitSignUp(): Promise<void> {
    if (this.isSignUpInProgress()) {
      return;
    }

    const email = this.signUpEmail().trim();
    const password = this.signUpPassword().trim();
    const confirmPassword = this.signUpConfirmPassword().trim();

    if (!email || !password) {
      this.signUpError.set('Informe email e senha para continuar.');
      return;
    }

    if (password !== confirmPassword) {
      this.signUpError.set('As senhas não coincidem.');
      return;
    }

    this.isSignUpInProgress.set(true);
    this.signUpError.set(null);

    const result = await this.authService.signUp(email, password);

    if (result.error) {
      this.signUpError.set(result.error);
      this.isSignUpInProgress.set(false);
      return;
    }

    this.handleSignUpSuccess(email);
  }

  private handleSignUpSuccess(email: string): void {
    this.signUpEmail.set(email);
    this.loginEmail.set(email);
    this.signUpSuccessEmail.set(email);
    this.signUpError.set(null);
    this.isSignUpDialogVisible.set(false);
    this.signUpPassword.set('');
    this.signUpConfirmPassword.set('');
    this.isSignUpInProgress.set(false);
    this.isSignUpSuccessDialogVisible.set(true);
  }

  closeSignUpSuccessDialog(): void {
    this.isSignUpSuccessDialogVisible.set(false);
  }

  openLoginFromSignUpDialog(): void {
    if (this.isSignUpInProgress()) {
      return;
    }

    const email = this.signUpEmail();
    if (email) {
      this.loginEmail.set(email);
    }

    this.isSignUpDialogVisible.set(false);
    this.openLoginDialog();
  }

  openLoginFromSignUpSuccess(): void {
    const email = this.signUpSuccessEmail();
    if (email) {
      this.loginEmail.set(email);
    }

    this.isSignUpSuccessDialogVisible.set(false);
    this.openLoginDialog();
  }

  async signOut(): Promise<void> {
    this.closeUserMenu();
    await this.authService.signOut();
    await this.resetAfterAuthChange();
  }

  openSettingsDialog(): void {
    this.closeUserMenu();
    this.deleteAccountError.set(null);
    this.isSettingsDialogVisible.set(true);
  }

  closeSettingsDialog(): void {
    if (this.isDeleteAccountInProgress()) {
      return;
    }

    this.isSettingsDialogVisible.set(false);
    this.deleteAccountError.set(null);
  }

  async confirmAccountDeletion(): Promise<void> {
    if (this.isDeleteAccountInProgress()) {
      return;
    }

    this.deleteAccountError.set(null);
    this.isDeleteAccountInProgress.set(true);

    try {
      const session = await this.supabaseAuthClient.getSession();
      if (!session) {
        await this.handleUnauthorizedDeletion('Não foi possível validar sua sessão. Faça login novamente.');
        return;
      }

      const response = await fetch('https://ouqykxafhtctlaymzoxw.functions.supabase.co/delete-account', {
        method: 'POST',
        headers: {
          Authorization: `${session.tokenType} ${session.accessToken}`,
        },
      });

      if (response.status === 200) {
        await this.handleAccountDeletionSuccess();
        return;
      }

      if (response.status === 401) {
        await this.handleUnauthorizedDeletion();
        return;
      }

      if (response.status >= 500) {
        this.deleteAccountError.set('Encontramos um problema ao excluir a conta. Tente novamente em instantes.');
        return;
      }

      this.deleteAccountError.set(await this.extractDeleteAccountError(response));
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      this.deleteAccountError.set('Não foi possível excluir a conta. Tente novamente.');
    } finally {
      this.isDeleteAccountInProgress.set(false);
    }
  }

  private async handleAccountDeletionSuccess(): Promise<void> {
    await this.supabaseAuthClient.signOut();
    await this.resetAfterAuthChange();
    this.redirectToPublicView();
  }

  private async handleUnauthorizedDeletion(message?: string): Promise<void> {
    this.supabaseAuthClient.clearLocalSession();
    if (message) {
      this.deleteAccountError.set(message);
    }
    await this.resetAfterAuthChange();
    this.openLoginDialog();
  }

  private async extractDeleteAccountError(response: Response): Promise<string> {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await response.json() as { message?: string; error?: string };
        const message = body.message ?? body.error;
        if (message && typeof message === 'string') {
          return message;
        }
      }

      const text = await response.text();
      if (text) {
        return text;
      }
    } catch (error) {
      console.error('Erro ao interpretar resposta de exclusão de conta:', error);
    }

    return 'Não foi possível excluir a conta. Tente novamente em instantes.';
  }

  private async resetAfterAuthChange(): Promise<void> {
    this.authService.resetState();
    this.galleryService.resetState();
    this.resetApplicationState();
    await this.galleryService.initialize();
  }

  private resetApplicationState(): void {
    this.contextMenu.set({ visible: false, x: 0, y: 0, groups: [] });
    this.expandedItem.set(null);
    this.isWebcamVisible.set(false);
    this.isGalleryEditorVisible.set(false);
    this.isGalleryCreationDialogVisible.set(false);
    this.isInfoDialogVisible.set(false);
    this.isSettingsDialogVisible.set(false);
    this.isUserMenuOpen.set(false);
    this.isAutoNavigationActive.set(false);
    this.autoNavigationCountdown.set(null);
    this.autoNavigationHintVisible.set(false);
    this.isLoginDialogVisible.set(false);
    this.loginPassword.set('');
    this.loginError.set(null);
    this.signUpEmail.set('');
    this.isSignUpDialogVisible.set(false);
    this.signUpPassword.set('');
    this.signUpConfirmPassword.set('');
    this.signUpError.set(null);
    this.signUpSuccessEmail.set(null);
    this.isSignUpSuccessDialogVisible.set(false);
    this.hasInitializedView.set(false);
    this.mobileCaptureGalleryId.set(null);
    this.mobileView.set('capture');
    this.mobileCommandPanelVisible.set(false);
    this.currentView.set('galleries');
    this.pendingCaptureToAssign.set(null);
    this.lastCapturedImage.set(null);
    this.isDeleteAccountInProgress.set(false);
    this.deleteAccountError.set(null);
  }

  private redirectToPublicView(): void {
    if (typeof window !== 'undefined' && window.location) {
      window.location.replace(window.location.origin || '/');
    }
  }

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isUserMenuOpen.update(isOpen => !isOpen);
  }

  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  onUserGalleryAction(): void {
    if (!this.canAccessUserGalleryActions()) {
      return;
    }

    const userGalleryId = this.currentUserGalleryId();
    if (userGalleryId) {
      this.selectGallery(userGalleryId);
      return;
    }

    this.openGalleryCreationDialog();
  }

  refreshApp(): void {
    this.closeUserMenu();
    window.location.reload();
  }

  pauseCanvasNavigation(): void {
    this.isNavigationPaused.set(true);
  }

  resumeCanvasNavigation(event?: FocusEvent | MouseEvent): void {
    if (event instanceof FocusEvent) {
      const currentTarget = event.currentTarget as HTMLElement | null;
      if (
        currentTarget &&
        event.relatedTarget instanceof HTMLElement &&
        currentTarget.contains(event.relatedTarget)
      ) {
        return;
      }
    }

    this.isNavigationPaused.set(false);
  }

  @HostListener('document:click', ['$event'])
  closeUserMenuOnOutside(event: MouseEvent): void {
    if (!this.isUserMenuOpen()) {
      return;
    }

    const target = event.target as HTMLElement | null;

    if (!target || !target.closest('.user-menu')) {
      this.isUserMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  closeUserMenuOnEscape(): void {
    if (this.isUserMenuOpen()) {
      this.isUserMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleZoomKeys(event: KeyboardEvent): void {
    if (!this.isInteractionEnabled()) return;

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-') {
      event.preventDefault();
      this.zoomOut();
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleArrowNavigation(event: KeyboardEvent): void {
    if (!isArrowKey(event.key)) {
      return;
    }

    const targetElement = event.target as HTMLElement | null;
    const isTyping = !!targetElement && (
      targetElement.tagName === 'INPUT' ||
      targetElement.tagName === 'TEXTAREA' ||
      targetElement.isContentEditable ||
      !!targetElement.closest('input') ||
      !!targetElement.closest('textarea')
    );

    if (isTyping || !this.isInteractionEnabled()) {
      return;
    }

    event.preventDefault();
    this.resetInactivityTimer();

    this.activeArrowKeys.add(event.key);
    this.updateKeyboardScrollDirection();
  }

  @HostListener('document:keyup', ['$event'])
  handleArrowNavigationRelease(event: KeyboardEvent): void {
    if (!isArrowKey(event.key)) {
      return;
    }

    if (!this.activeArrowKeys.size) {
      return;
    }

    event.preventDefault();
    this.activeArrowKeys.delete(event.key);
    this.updateKeyboardScrollDirection();
  }

  galleryService = inject(GalleryService);
  themeService = inject(ThemeService);
  authService = inject(AuthService);
  permissionsService = inject(PermissionsService);
  supabaseAuthClient = inject(SupabaseAuthClientService);
  private supabaseAuthSubscription: SupabaseAuthSubscription | null = null;

  canManageContent = this.permissionsService.canManageContent;
  authUserEmail = computed(() => this.authService.session()?.user?.email ?? null);
  isAuthenticated = computed(() => this.authService.isAuthenticated());
  isAppLoading = computed(() => this.authService.isLoading() || this.galleryService.isLoading());
  currentUserGalleryId = computed(() => this.galleryService.currentUserGalleryId());
  canUploadToGallery = this.permissionsService.canUploadToSelectedGallery;
  canDeletePhoto = this.permissionsService.canDeletePhotoFromSelectedGallery;
  userRoleLabel = computed(() => {
    const role = this.authService.userRole();
    if (role) {
      return role;
    }

    return this.canManageContent() ? 'Admin' : 'Usuário';
  });
  appLoadingMessage = computed(() => {
    if (this.authService.isLoading()) {
      return 'Validando sua sessão e preferências...';
    }

    if (this.galleryService.isLoading()) {
      return this.isAuthenticated()
        ? 'Sincronizando suas galerias e permissões...'
        : 'Carregando coleções disponíveis...';
    }

    return 'Preparando sua experiência na galeria';
  });
  appLoadingHint = computed(() =>
    this.isAuthenticated()
      ? 'Estamos deixando tudo pronto para você continuar a curadoria sem interrupções.'
      : 'Em instantes você poderá explorar e capturar novas imagens.'
  );
  isUserMenuOpen = signal(false);
  private hasInitializedView = signal(false);
  canCreateGalleries = this.permissionsService.canCreateGalleries;
  canManageSelectedGallery = this.permissionsService.canManageSelectedGallery;
  canCaptureInSelectedGallery = this.permissionsService.canCaptureInSelectedGallery;
  canEditSelectedGallery = this.permissionsService.canEditSelectedGallery;
  canDeleteSelectedGallery = this.permissionsService.canDeleteSelectedGallery;
  canViewMobileGalleryList = this.permissionsService.canViewMobileGalleryList;
  canUseCaptureDialog = this.permissionsService.canUseCaptureDialog;
  canAccessUserGalleryActions = this.permissionsService.canCreateOwnGallery;
  hasUserGallery = computed(() => !!this.currentUserGalleryId());
  userGalleryActionLabel = computed(() =>
    this.hasUserGallery() ? 'Ir para minha galeria' : 'Criar minha galeria'
  );

  isLoginDialogVisible = signal(false);
  loginEmail = signal('');
  loginPassword = signal('');
  loginError = signal<string | null>(null);
  isLoginInProgress = signal(false);
  isSignUpDialogVisible = signal(false);
  signUpEmail = signal('');
  signUpPassword = signal('');
  signUpConfirmPassword = signal('');
  signUpError = signal<string | null>(null);
  isSignUpInProgress = signal(false);
  isSignUpSuccessDialogVisible = signal(false);
  signUpSuccessEmail = signal<string | null>(null);
  isSettingsDialogVisible = signal(false);
  deleteAccountError = signal<string | null>(null);
  isDeleteAccountInProgress = signal(false);
  private ngZone = inject(NgZone);
  private elementRef = inject(ElementRef<HTMLElement>);
  private closeUserMenuOnLayoutChange = effect(
    () => {
      this.isMobileLayout();
      this.mobileView();

      if (untracked(this.isUserMenuOpen)) {
        this.isUserMenuOpen.set(false);
      }
    },
    { allowSignalWrites: true }
  );

  // --- Configurações da Galeria ---
  private numColumns = signal(4);
  private readonly ITEM_GAP = 32;
  private readonly settings = {
    dragEase: 0.075,
    bufferZone: 1.5,
    zoomDuration: 0.6,
  };
  private readonly GALLERY_PREVIEW_DELAY = 300;
  private readonly GALLERY_PREVIEW_INTERVAL = 500;
  private readonly AUTO_NAVIGATION_COUNTDOWN_DURATION = 3;
  private readonly AUTO_NAVIGATION_HINT_DURATION = 4000;

  // --- Sinais para o Estado da UI ---
  currentView = signal<'galleries' | 'photos'>('galleries'); // 'galleries' or 'photos'
  images = computed(() => this.galleryService.images());
  visibleItems = signal<VisibleItem[]>([]);
  expandedItem = signal<ExpandedItem | null>(null);
  isWebcamVisible = signal(false);
  contextMenu = signal<{ visible: boolean; x: number; y: number; groups: ContextMenuGroup[] }>({
    visible: false,
    x: 0,
    y: 0,
    groups: [],
  });
  isFullscreen = signal(false);
  private isViewInitialized = signal(false);
  galleryPreviewImages = signal<Record<string, string>>({});
  isAutoNavigationActive = signal(false);
  autoNavigationCountdown = signal<number | null>(null);
  autoNavigationHintVisible = signal(false);
  isNavigationPaused = signal(false);
  autoNavigationOverlayVisible = computed(
    () => this.autoNavigationCountdown() !== null || this.autoNavigationHintVisible()
  );

  // --- Layout Responsivo ---
  private readonly MOBILE_BREAKPOINT = 768;
  private readonly MOBILE_LOGIN_LONG_PRESS_DURATION = 10000;
  isMobileLayout = signal(false);
  mobileCommandPanelVisible = signal(false);
  captureMode = signal<'selected'>('selected');
  pendingCaptures = computed(() => this.galleryService.pendingCaptures());
  lastCapturedImage = signal<string | null>(null);
  pendingCaptureToAssign = signal<string | null>(null);
  selectedPendingCapture = computed(() => {
    const pending = this.pendingCaptures();
    if (pending.length === 0) {
      return null;
    }

    const selected = this.pendingCaptureToAssign();
    if (selected && pending.includes(selected)) {
      return selected;
    }

    return pending[0];
  });
  isLastCapturePending = computed(() => {
    const last = this.lastCapturedImage();
    if (!last) {
      return false;
    }
    return this.pendingCaptures().includes(last);
  });
  mobileView = signal<'capture' | 'galleries' | 'galleryDetail'>('capture');
  mobileCaptureGalleryId = signal<string | null>(null);
  mobileCaptureGallery = computed(() => {
    const captureId = this.mobileCaptureGalleryId();
    if (!captureId) {
      return null;
    }
    return this.galleries().find(gallery => gallery.id === captureId) ?? null;
  });
  canSelectMobileCaptureGallery = computed(
    () => this.canViewMobileGalleryList() && this.canManageContent()
  );
  desktopCaptureGalleryId = signal<string | null>(null);
  desktopCaptureGallery = computed(() => {
    const captureId = this.desktopCaptureGalleryId();
    if (!captureId) {
      return null;
    }
    return this.galleries().find(gallery => gallery.id === captureId) ?? null;
  });
  mobileCaptureAllowed = computed(() => {
    const gallery = this.mobileCaptureGallery();
    if (!gallery) {
      return false;
    }

    if (typeof gallery.canUploadToGallery === 'boolean') {
      return gallery.canUploadToGallery;
    }

    return this.authService.canManageGallery(gallery.ownerId ?? '');
  });
  capturableGalleries = computed(() =>
    this.galleries().filter(gallery => this.permissionsService.canCaptureInGallery(gallery.id)),
  );
  desktopCaptureAllowed = computed(() => {
    const gallery = this.desktopCaptureGallery();
    if (!gallery) {
      return false;
    }

    if (typeof gallery.canUploadToGallery === 'boolean') {
      return gallery.canUploadToGallery;
    }

    return this.permissionsService.canCaptureInGallery(gallery.id);
  });
  galleryLatestImages = computed(() => {
    const latest: Record<string, string> = {};
    for (const gallery of this.galleries()) {
      const [recent] = gallery.imageUrls;
      if (recent) {
        latest[gallery.id] = recent;
      }
    }
    return latest;
  });
  galleries = computed(() => this.galleryService.galleries());
  activeGallery = computed(() => {
    const selectedId = this.galleryService.selectedGalleryId();
    if (!selectedId) {
      return null;
    }
    return this.galleryService.getGallery(selectedId) ?? null;
  });
  private mobileScrollTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private mobileScrollResetTimeout: ReturnType<typeof setTimeout> | null = null;
  private mobileGallerySelectorLongPressTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private assignNextGalleryToMobileCapture = false;
  private lastMobileScrollTop = 0;

  // --- Sinais para o Relógio e Data ---
  currentTime = signal('');
  currentDate = signal('');
  private clockIntervalId: any;

  // --- Sinais para Contagem de Fotos e Galerias ---
  photoCount = computed(() => this.images().length);
  galleryCount = computed(() => this.galleryService.galleries().length);
  photoCounterLabel = computed(() => (this.photoCount() <= 1 ? "f." : "f's."));
  galleryCounterLabel = computed(() => (this.galleryCount() <= 1 ? "g." : "g's."));

  // --- Sinais para o Editor de Galeria ---
  isGalleryEditorVisible = signal(false);
  editingGallery = signal<Gallery | null>(null);
  isGalleryCreationDialogVisible = signal(false);
  isInfoDialogVisible = signal(false);

  // --- Sinais e Propriedades para o Modo Ocioso ---
  isIdle = signal(false);
  private inactivityTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private idleEllipseAngle = 0;
  private idleEllipseCenter = { x: 0, y: 0 };
  private idleEllipseRadiusX = 0; // Semi-eixo maior (horizontal) - será calculado baseado na tela
  private idleEllipseRadiusY = 0; // Semi-eixo menor (vertical) - será calculado baseado na tela
  private readonly idleSpeed = 0.001; // Velocidade angular (reduzida para movimento mais lento)

  // --- Propriedades para o Context Menu ---
  private contextMenuGalleryId: string | null = null;
  private contextMenuPhotoUrl: string | null = null;
  private readonly generalGroupLabel = 'Ações gerais';

  private createGeneralGroup(includePlayback: boolean = true): ContextMenuGroup {
    const actions: ContextMenuAction[] = ['toggleTheme'];

    if (includePlayback && this.currentView() === 'galleries') {
      actions.push('togglePlayback');
    }

    actions.push('toggleFullscreen', 'info');

    return {
      label: this.generalGroupLabel,
      actions,
    };
  }

  private isTypingElement(target: HTMLElement | null): boolean {
    return !!target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      !!target.closest('input') ||
      !!target.closest('textarea')
    );
  }

  isInteractionEnabled = computed(
    () =>
      !this.expandedItem() &&
      !this.isWebcamVisible() &&
      !this.isGalleryEditorVisible() &&
      !this.isGalleryCreationDialogVisible() &&
      !this.isInfoDialogVisible() &&
      !this.isSettingsDialogVisible() &&
      !this.isAutoNavigationActive() &&
      !this.isNavigationPaused()
  );

  // --- Referências a Elementos do Template ---
  private canvasWrapper = viewChild<ElementRef<HTMLDivElement>>('canvasWrapper');
  private expandedItemElement = viewChild<ElementRef<HTMLDivElement>>('expandedItemElement');
  private mobileScrollContainer = viewChild<ElementRef<HTMLDivElement>>('mobileScrollContainer');

  // --- Estado Privado para Lógica de Animação ---
  private itemDimensions = { width: 0, height: 0, cellWidth: 0, cellHeight: 0 };
  private target = { x: 0, y: 0 };
  private current = { x: 0, y: 0 };
  private viewport = { width: 0, height: 0 };
  private initialPosition = { x: 0, y: 0 };
  private teleportDistance = { x: 0, y: 0 };
  private hasInitializedPosition = false;
  private readonly EDGE_THRESHOLD = 150;
  private readonly MAX_SCROLL_SPEED = 25;
  private readonly activeArrowKeys = new Set<ArrowKey>();
  private keyboardScrollDirection = { x: 0, y: 0 };
  private readonly interactionState: { isMouseOver: boolean; mouseX: number; mouseY: number } = {
    isMouseOver: false,
    mouseX: 0,
    mouseY: 0,
  };
  private animationFrameId: number | null = null;
  private lastGridPosition = { x: -1, y: -1 };
  private readonly galleryPreviewTimers = new Map<string, {
    startTimeoutId: ReturnType<typeof setTimeout> | null;
    intervalId: ReturnType<typeof setInterval> | null;
  }>();
  private autoNavigationCountdownIntervalId: ReturnType<typeof setInterval> | null = null;
  private autoNavigationHintTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // --- Listeners de eventos vinculados para remoção correta ---
  private boundCloseContextMenu: (event: MouseEvent) => void;
  private boundOnFullscreenChange: () => void;
  private boundOnMouseEnter: () => void;
  private boundOnMouseLeave: () => void;
  private boundOnMouseMove: (event: MouseEvent) => void;
  private interactiveCursor: InteractiveCursor | null = null;
  private readonly supportsFinePointer = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

  constructor() {
    this.boundCloseContextMenu = this.closeContextMenu.bind(this);
    this.boundOnFullscreenChange = this.onFullscreenChange.bind(this);
    this.boundOnMouseEnter = this.onMouseEnter.bind(this);
    this.boundOnMouseLeave = this.onMouseLeave.bind(this);
    this.boundOnMouseMove = this.onMouseMove.bind(this);

    if (this.supportsFinePointer) {
      effect(() => {
        const shouldHideCursor = this.isIdle() || this.isAutoNavigationActive();
        document.body.classList.toggle('custom-cursor-hidden', shouldHideCursor);
      });
    }

    effect(() => {
      if (!this.isViewInitialized()) return;
      // React to changes in currentView, images (selected gallery's photos), and galleries
      this.currentView();
      this.images();
      this.galleryService.galleries();
      this.updateVisibleItems(true);
    });

    effect(() => {
      if (!this.isViewInitialized()) {
        return;
      }

      const isMobile = this.isMobileLayout();
      const view = this.currentView();
      const galleries = this.galleryService.galleries();

      if (isMobile && view === 'galleries' && galleries.length > 0) {
        this.resetMobileScrollPosition();
      }
    });

    effect(() => {
      const elementRef = this.expandedItemElement();
      const item = this.expandedItem();
      if (elementRef && item) {
        this.runExpandAnimation(elementRef.nativeElement, item);
      }
    });

    effect(() => {
      const pending = this.pendingCaptures();
      if (pending.length === 0) {
        if (this.pendingCaptureToAssign()) {
          this.pendingCaptureToAssign.set(null);
        }
        return;
      }

      const selected = this.pendingCaptureToAssign();
      if (!selected || !pending.includes(selected)) {
        this.pendingCaptureToAssign.set(pending[0]);
      }
    });

    effect(() => {
      const availableGalleries = this.galleries();
      const selectedCaptureId = this.mobileCaptureGalleryId();

      if (selectedCaptureId && !availableGalleries.some(gallery => gallery.id === selectedCaptureId)) {
        this.mobileCaptureGalleryId.set(null);
      }

      if (!selectedCaptureId && availableGalleries.length === 1) {
        this.mobileCaptureGalleryId.set(availableGalleries[0].id);
      }
    });

    effect(
      () => {
        const availableCaptures = this.capturableGalleries();
        const selectedCaptureId = this.mobileCaptureGalleryId();
        const activeGalleryId = this.galleryService.selectedGalleryId();

        const isSelectedValid =
          selectedCaptureId !== null && availableCaptures.some(gallery => gallery.id === selectedCaptureId);

        if (selectedCaptureId && !isSelectedValid) {
          this.mobileCaptureGalleryId.set(null);
          return;
        }

        if (!selectedCaptureId && activeGalleryId) {
          const activeCapturable = availableCaptures.some(gallery => gallery.id === activeGalleryId);
          if (activeCapturable) {
            this.mobileCaptureGalleryId.set(activeGalleryId);
          }
        }
      },
      { allowSignalWrites: true },
    );

    effect(
      () => {
        const availableGalleries = this.capturableGalleries();
        const selectedDesktopCaptureId = this.desktopCaptureGalleryId();

        if (selectedDesktopCaptureId && !availableGalleries.some(gallery => gallery.id === selectedDesktopCaptureId)) {
          this.desktopCaptureGalleryId.set(availableGalleries[0]?.id ?? null);
        }

        if (!selectedDesktopCaptureId && availableGalleries.length === 1) {
          this.desktopCaptureGalleryId.set(availableGalleries[0].id);
        }
      },
      { allowSignalWrites: true },
    );

    effect(() => {
      if (!this.isGalleryCreationDialogVisible()) {
        this.assignNextGalleryToMobileCapture = false;
      }
    });

    effect(
      () => {
        const isLoading = this.authService.isLoading();
        const isGalleryLoading = this.galleryService.isLoading();
        const session = this.authService.session();
        const userGalleryId = this.currentUserGalleryId();
        const isMobile = this.isMobileLayout();
        const isAdmin = this.canManageContent();
        const hasGalleries = this.galleries().length > 0;

        if (isLoading || isGalleryLoading) {
          return;
        }

        if (!session) {
          this.hasInitializedView.set(false);
          return;
        }

        if (this.hasInitializedView()) {
          return;
        }

        if (!isAdmin && !hasGalleries) {
          this.currentView.set('galleries');
          if (isMobile) {
            this.mobileView.set('galleries');
          }

          this.isGalleryCreationDialogVisible.set(true);
          this.hasInitializedView.set(true);
          return;
        }

        if (isAdmin) {
          this.currentView.set('galleries');
          if (isMobile) {
            this.mobileView.set('capture');
          }
        } else if (userGalleryId) {
          this.galleryService.selectGallery(userGalleryId);
          this.currentView.set('photos');
          this.mobileCaptureGalleryId.set(userGalleryId);
          if (isMobile) {
            this.mobileView.set('capture');
          }
        }

        this.hasInitializedView.set(true);
      },
      { allowSignalWrites: true },
    );

    effect(() => {
      if (this.isAuthenticated() || this.isLoginDialogVisible() || this.isLoginInProgress()) {
        return;
      }

      if (this.isWebcamVisible()) {
        this.isWebcamVisible.set(false);
      }

      if (this.isGalleryEditorVisible()) {
        this.isGalleryEditorVisible.set(false);
        this.editingGallery.set(null);
      }

      if (this.isGalleryCreationDialogVisible()) {
        this.isGalleryCreationDialogVisible.set(false);
      }

      if (this.contextMenu().visible) {
        this.contextMenu.set({ visible: false, x: 0, y: 0, groups: [] });
        this.contextMenuGalleryId = null;
      }
    });

    this.resetInactivityTimer();
  }

  ngOnInit(): void {
    const supabaseClient: SupabaseClientLike = this.authService.getSupabaseClient();
    const { data } = supabaseClient.auth.onAuthStateChange((event, session) => {
      console.log(`Supabase auth event: ${event}`);

      if (event === 'SIGNED_IN' && session) {
        this.authService.initialize().catch(error => {
          console.error('Falha ao inicializar sessão após retorno do Supabase:', error);
        });
      }
    });

    this.supabaseAuthSubscription = data.subscription;
    this.startAnimationLoop();
    document.addEventListener('click', this.boundCloseContextMenu, true);
    document.addEventListener('fullscreenchange', this.boundOnFullscreenChange);

    this.updateTime();
    this.updateDate();
    this.clockIntervalId = setInterval(() => this.updateTime(), 1000);
  }

  ngAfterViewInit(): void {
    this.onResize();
    this.isViewInitialized.set(true);
    const resizeObserver = new ResizeObserver(() => this.onResize());
    resizeObserver.observe(this.elementRef.nativeElement);

    const hostElement = this.elementRef.nativeElement;
    hostElement.addEventListener('mouseenter', this.boundOnMouseEnter);
    hostElement.addEventListener('mouseleave', this.boundOnMouseLeave);
    window.addEventListener('mousemove', this.boundOnMouseMove);

    if (this.supportsFinePointer) {
      this.interactiveCursor = new InteractiveCursor('.custom-cursor');
    }

    if (this.isMobileLayout()) {
      this.scheduleMobilePanelReveal();
    }
  }

  ngOnDestroy(): void {
    this.stopAllGalleryPreviews();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.supabaseAuthSubscription) {
      this.supabaseAuthSubscription.unsubscribe();
      this.supabaseAuthSubscription = null;
    }
    document.removeEventListener('click', this.boundCloseContextMenu, true);
    document.removeEventListener('fullscreenchange', this.boundOnFullscreenChange);
    const hostElement = this.elementRef.nativeElement;
    hostElement.removeEventListener('mouseenter', this.boundOnMouseEnter);
    hostElement.removeEventListener('mouseleave', this.boundOnMouseLeave);
    window.removeEventListener('mousemove', this.boundOnMouseMove);

    if (this.clockIntervalId) {
      clearInterval(this.clockIntervalId);
    }
    clearTimeout(this.inactivityTimeoutId);
    if (this.autoNavigationHintTimeoutId) {
      clearTimeout(this.autoNavigationHintTimeoutId);
      this.autoNavigationHintTimeoutId = null;
    }
    this.autoNavigationHintVisible.set(false);
    this.interactiveCursor?.destroy();
    this.interactiveCursor = null;
    document.body.classList.remove('custom-cursor-hidden');
    this.clearMobileScrollTimeout();
    if (this.mobileScrollResetTimeout) {
      clearTimeout(this.mobileScrollResetTimeout);
      this.mobileScrollResetTimeout = null;
    }
    this.clearMobileGallerySelectorLongPress();
  }

  // --- Lógica do Grid e Animação ---

  private resetInactivityTimer(): void {
    if (this.isAutoNavigationActive()) {
      this.deactivateAutoNavigation(true);
    } else {
      this.exitIdleMode();
    }

    if (this.inactivityTimeoutId) {
      clearTimeout(this.inactivityTimeoutId);
      this.inactivityTimeoutId = null;
    }

    if (this.isAutoNavigationSequenceActive()) {
      return;
    }
  }

  private configureIdleEllipse(): void {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    this.idleEllipseRadiusX = screenWidth * 2.5;
    this.idleEllipseRadiusY = screenHeight * 1.5;

    const currentTargetX = this.target.x;
    const currentTargetY = this.target.y;

    this.idleEllipseCenter.x = currentTargetX - this.idleEllipseRadiusX;
    this.idleEllipseCenter.y = currentTargetY;

    this.idleEllipseAngle = 0;
  }

  private exitIdleMode(): void {
    if (!this.isIdle()) {
      return;
    }

    this.isIdle.set(false);
    this.idleEllipseAngle = 0;
  }

  private calculateGridDimensions(): void {
    const totalGapWidth = (this.numColumns() - 1) * this.ITEM_GAP;
    const containerWidth = this.elementRef.nativeElement.clientWidth;
    this.itemDimensions.width = (containerWidth - totalGapWidth) / this.numColumns();
    this.itemDimensions.height = this.itemDimensions.width;
    this.itemDimensions.cellWidth = this.itemDimensions.width + this.ITEM_GAP;
    this.itemDimensions.cellHeight = this.itemDimensions.height + this.ITEM_GAP;
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    this.viewport.width = rect.width;
    this.viewport.height = rect.height;
  }

  private updateTeleportationAnchors(): void {
    if (this.viewport.width === 0 || this.viewport.height === 0) {
      return;
    }

    const baseX = -this.itemDimensions.cellWidth + (this.viewport.width - this.itemDimensions.width) / 2;
    const baseY = -this.itemDimensions.cellHeight + (this.viewport.height - this.itemDimensions.height) / 2;

    const deltaX = baseX - this.initialPosition.x;
    const deltaY = baseY - this.initialPosition.y;

    this.initialPosition.x = baseX;
    this.initialPosition.y = baseY;

    const visibleColumns = Math.max(
      this.numColumns(),
      Math.ceil(this.viewport.width / this.itemDimensions.cellWidth)
    );
    const visibleRows = Math.max(
      1,
      Math.ceil(this.viewport.height / this.itemDimensions.cellHeight)
    );

    this.teleportDistance.x = this.itemDimensions.cellWidth * (visibleColumns + this.settings.bufferZone * 2);
    this.teleportDistance.y = this.itemDimensions.cellHeight * (visibleRows + this.settings.bufferZone * 2);

    if (this.hasInitializedPosition) {
      this.current.x += deltaX;
      this.current.y += deltaY;
      this.target.x += deltaX;
      this.target.y += deltaY;
    } else {
      this.current.x = baseX;
      this.current.y = baseY;
      this.target.x = baseX;
      this.target.y = baseY;
      this.hasInitializedPosition = true;
    }
  }

  private applyTeleportation(): void {
    if (!this.hasInitializedPosition) {
      return;
    }

    const { x: baseX, y: baseY } = this.initialPosition;
    const { x: distanceX, y: distanceY } = this.teleportDistance;

    if (distanceX > 0) {
      if (this.current.x > baseX + distanceX) {
        this.current.x -= distanceX;
        this.target.x -= distanceX;
      } else if (this.current.x < baseX - distanceX) {
        this.current.x += distanceX;
        this.target.x += distanceX;
      }
    }

    if (distanceY > 0) {
      if (this.current.y > baseY + distanceY) {
        this.current.y -= distanceY;
        this.target.y -= distanceY;
      } else if (this.current.y < baseY - distanceY) {
        this.current.y += distanceY;
        this.target.y += distanceY;
      }
    }
  }

  private onMouseEnter(): void {
    this.interactionState.isMouseOver = true;
    if (this.isAutoNavigationActive()) {
      return;
    }

    this.resetInactivityTimer();
  }

  private onMouseLeave(): void {
    this.interactionState.isMouseOver = false;
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.interactionState.isMouseOver) {
      return;
    }

    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;
    const clampedX = Math.min(Math.max(relativeX, 0), rect.width);
    const clampedY = Math.min(Math.max(relativeY, 0), rect.height);

    this.interactionState.mouseX = clampedX;
    this.interactionState.mouseY = clampedY;

    if (this.isAutoNavigationActive()) {
      return;
    }

    this.resetInactivityTimer();
  }

  private calculateEdgeScroll(): { deltaX: number; deltaY: number } {
    if (!this.interactionState.isMouseOver) {
      return { deltaX: 0, deltaY: 0 };
    }

    if (this.contextMenu().visible) {
      return { deltaX: 0, deltaY: 0 };
    }

    const width = this.viewport.width;
    const height = this.viewport.height;

    if (width <= 0 || height <= 0) {
      return { deltaX: 0, deltaY: 0 };
    }

    const { mouseX, mouseY } = this.interactionState;
    let deltaX = 0;
    let deltaY = 0;

    if (mouseX < this.EDGE_THRESHOLD) {
      const intensity = Math.min(1, Math.max(0, 1 - mouseX / this.EDGE_THRESHOLD));
      deltaX = intensity * this.MAX_SCROLL_SPEED;
    } else if (mouseX > width - this.EDGE_THRESHOLD) {
      const distance = mouseX - (width - this.EDGE_THRESHOLD);
      const intensity = Math.min(1, Math.max(0, distance / this.EDGE_THRESHOLD));
      deltaX = -intensity * this.MAX_SCROLL_SPEED;
    }

    if (mouseY < this.EDGE_THRESHOLD) {
      const intensity = Math.min(1, Math.max(0, 1 - mouseY / this.EDGE_THRESHOLD));
      deltaY = intensity * this.MAX_SCROLL_SPEED;
    } else if (mouseY > height - this.EDGE_THRESHOLD) {
      const distance = mouseY - (height - this.EDGE_THRESHOLD);
      const intensity = Math.min(1, Math.max(0, distance / this.EDGE_THRESHOLD));
      deltaY = -intensity * this.MAX_SCROLL_SPEED;
    }

    return { deltaX, deltaY };
  }

  private calculateKeyboardScroll(): { deltaX: number; deltaY: number } {
    if (this.keyboardScrollDirection.x === 0 && this.keyboardScrollDirection.y === 0) {
      return { deltaX: 0, deltaY: 0 };
    }

    return {
      deltaX: this.keyboardScrollDirection.x * this.MAX_SCROLL_SPEED,
      deltaY: this.keyboardScrollDirection.y * this.MAX_SCROLL_SPEED,
    };
  }

  // --- Layout Responsivo Mobile ---
  private updateResponsiveLayout(): void {
    const isMobile = window.innerWidth <= this.MOBILE_BREAKPOINT;
    const previousState = this.isMobileLayout();
    this.isMobileLayout.set(isMobile);

    if (isMobile) {
      if (!previousState) {
        this.mobileView.set('capture');
        this.mobileCommandPanelVisible.set(false);
      }
      this.scheduleMobilePanelReveal(previousState ? 600 : 400);
    } else if (previousState) {
      this.mobileCommandPanelVisible.set(false);
      this.clearMobileScrollTimeout();
      this.lastMobileScrollTop = 0;
    }
  }

  private clearMobileScrollTimeout(): void {
    if (this.mobileScrollTimeoutId) {
      clearTimeout(this.mobileScrollTimeoutId);
      this.mobileScrollTimeoutId = null;
    }
  }

  private clearMobileGallerySelectorLongPress(): void {
    if (this.mobileGallerySelectorLongPressTimeoutId) {
      clearTimeout(this.mobileGallerySelectorLongPressTimeoutId);
      this.mobileGallerySelectorLongPressTimeoutId = null;
    }
  }

  private scheduleMobilePanelReveal(delay: number = 600): void {
    if (!this.isMobileLayout()) {
      return;
    }

    this.clearMobileScrollTimeout();
    this.mobileScrollTimeoutId = setTimeout(() => {
      this.mobileCommandPanelVisible.set(true);
      this.mobileScrollTimeoutId = null;
    }, delay);
  }

  private resetMobileScrollPosition(): void {
    if (!this.isMobileLayout()) {
      return;
    }

    if (this.mobileScrollResetTimeout) {
      clearTimeout(this.mobileScrollResetTimeout);
    }

    this.mobileScrollResetTimeout = setTimeout(() => {
      const containerRef = this.mobileScrollContainer();
      if (!containerRef) {
        return;
      }

      const element = containerRef.nativeElement;
      element.scrollTo({ top: 0, behavior: 'auto' });
      this.lastMobileScrollTop = element.scrollTop;
    }, 0);
  }

  onMobileScroll(): void {
    if (!this.isMobileLayout()) {
      return;
    }

    const containerRef = this.mobileScrollContainer();
    if (containerRef) {
      this.lastMobileScrollTop = containerRef.nativeElement.scrollTop;
    }

    this.mobileCommandPanelVisible.set(false);
    this.scheduleMobilePanelReveal(700);
  }

  onMobileGallerySelectorPressStart(event: PointerEvent): void {
    if (event.pointerType !== 'touch') {
      return;
    }

    if (this.isAuthenticated() || this.isLoginDialogVisible() || this.isLoginInProgress()) {
      return;
    }

    if (!this.isMobileLayout()) {
      return;
    }

    this.clearMobileGallerySelectorLongPress();
    this.mobileGallerySelectorLongPressTimeoutId = setTimeout(() => {
      this.mobileGallerySelectorLongPressTimeoutId = null;
      this.ngZone.run(() => this.openLoginDialog());
    }, this.MOBILE_LOGIN_LONG_PRESS_DURATION);
  }

  onMobileGallerySelectorPressEnd(): void {
    this.clearMobileGallerySelectorLongPress();
  }

  onMobileGallerySelectorPressCancel(): void {
    this.clearMobileGallerySelectorLongPress();
  }

  onMobilePhotoClick(event: MouseEvent, imageUrl: string, index: number): void {
    if (!this.isInteractionEnabled()) {
      return;
    }

    const placeholderItem: PhotoItem = {
      type: 'photo',
      id: `mobile-${index}`,
      url: imageUrl,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      col: 0,
      row: 0,
      creationOrder: index + 1,
    };

    this.expandItem(placeholderItem, event.currentTarget as HTMLElement);
  }

  async deleteExpandedPhoto(event: MouseEvent): Promise<void> {
    event.stopPropagation();

    if (!this.canManageSelectedGallery()) {
      return;
    }

    const item = this.expandedItem();
    if (!item) {
      return;
    }

    await this.deletePhotoByUrl(item.url);
  }

  mobileAddAction(): void {
    if (this.currentView() === 'galleries') {
      if (this.canCreateGalleries()) {
        this.openGalleryCreationDialog();
      }
    } else if (this.canUseCaptureDialog()) {
      this.openWebcamCapture();
    }
  }

  private resolveCaptureTargetGallery(): string | null {
    const selectedGalleryId = this.galleryService.selectedGalleryId();
    if (this.permissionsService.canCaptureInGallery(selectedGalleryId)) {
      return selectedGalleryId;
    }

    const userGalleryId = this.currentUserGalleryId();
    if (userGalleryId && this.permissionsService.canCaptureInGallery(userGalleryId)) {
      return userGalleryId;
    }

    const capturableGalleries = this.galleries().filter(gallery =>
      this.permissionsService.canCaptureInGallery(gallery.id)
    );

    if (capturableGalleries.length === 0) {
      return null;
    }

    if (capturableGalleries.length === 1) {
      return capturableGalleries[0].id;
    }

    if (this.canManageContent() && this.currentView() === 'galleries') {
      return this.promptGallerySelectionForCapture(capturableGalleries);
    }

    return capturableGalleries[0].id;
  }

  private promptGallerySelectionForCapture(galleries: Gallery[]): string | null {
    const galleryOptions = galleries
      .map((gallery, index) => `${index + 1}. ${gallery.name}`)
      .join('\n');

    const selection = window.prompt(
      'Selecione a galeria para capturar (digite o número correspondente):\n' + galleryOptions
    );

    if (!selection) {
      return null;
    }

    const selectedIndex = Number.parseInt(selection, 10) - 1;
    if (Number.isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= galleries.length) {
      return null;
    }

    return galleries[selectedIndex].id;
  }

  startCaptureForGallery(galleryId: string): void {
    if (!this.permissionsService.canCaptureInGallery(galleryId)) {
      return;
    }

    if (this.isMobileLayout()) {
      this.showCaptureWithGallery(galleryId);
      return;
    }

    this.onDesktopGalleryChange(galleryId);
    this.openWebcamCapture();
  }

  viewGallery(galleryId: string): void {
    if (this.isMobileLayout()) {
      this.openMobileGalleryDetail(galleryId);
      return;
    }

    this.selectGallery(galleryId);
  }

  showMobileCapture(): void {
    this.currentView.set('galleries');
    this.mobileView.set('capture');
    this.handleMobileNavigationTransition();
  }

  openMobileGalleryDetail(galleryId: string): void {
    if (!this.canViewMobileGalleryList() && galleryId !== this.currentUserGalleryId()) {
      return;
    }
    this.selectGallery(galleryId);
    this.mobileView.set('galleryDetail');
  }

  async deleteActiveGalleryFromMobile(): Promise<void> {
    if (!this.canDeleteSelectedGallery()) {
      return;
    }

    const activeGallery = this.activeGallery();
    if (!activeGallery) {
      return;
    }

    const shouldDelete = window.confirm('Tem certeza que deseja excluir esta galeria? Esta ação não pode ser desfeita.');
    if (!shouldDelete) {
      return;
    }

    const success = await this.galleryService.deleteGallery(activeGallery.id);
    if (!success) {
      this.notifyGalleryError();
      return;
    }
    this.updateVisibleItems(true);
    this.returnToMobileGalleries();
  }

  returnToMobileGalleries(): void {
    if (!this.canViewMobileGalleryList()) {
      this.mobileView.set('capture');
      this.handleMobileNavigationTransition();
      return;
    }
    this.currentView.set('galleries');
    this.mobileView.set('galleries');
    this.handleMobileNavigationTransition();
  }

  showCaptureWithGallery(galleryId: string): void {
    if (!this.permissionsService.canCaptureInGallery(galleryId)) {
      return;
    }
    this.mobileCaptureGalleryId.set(galleryId);
    this.galleryService.selectGallery(galleryId);
    this.showMobileCapture();
  }

  useGalleryForCapture(galleryId: string): void {
    if (!this.permissionsService.canCaptureInGallery(galleryId)) {
      return;
    }
    this.mobileCaptureGalleryId.set(galleryId);
    this.showMobileCapture();
  }

  openMobileGalleryPicker(): void {
    if (!this.canViewMobileGalleryList()) {
      return;
    }
    this.currentView.set('galleries');
    this.mobileView.set('galleries');
    this.handleMobileNavigationTransition();
  }

  selectMobileCaptureGallery(galleryId: string): void {
    if (!this.permissionsService.canCaptureInGallery(galleryId)) {
      return;
    }
    this.mobileCaptureGalleryId.set(galleryId);
    this.showMobileCapture();
  }

  prepareMobileCapture(): void {
    const captureId = this.mobileCaptureGalleryId();
    if (!captureId) {
      return;
    }

    if (!this.permissionsService.canCaptureInGallery(captureId)) {
      return;
    }

    this.galleryService.selectGallery(captureId);
    this.captureMode.set('selected');
  }

  prepareDesktopCapture(): void {
    const captureId = this.desktopCaptureGalleryId();
    if (!captureId) {
      return;
    }

    if (!this.permissionsService.canCaptureInGallery(captureId)) {
      return;
    }

    this.galleryService.selectGallery(captureId);
    this.captureMode.set('selected');
  }

  onDesktopGallerySelect(event: Event, captureComponent?: WebcamCaptureComponent): void {
    const target = event.target as HTMLSelectElement | null;
    const selectedId = target?.value;
    if (!selectedId) {
      return;
    }

    this.onDesktopGalleryChange(selectedId);
    captureComponent?.notifyGalleryChange(selectedId);
  }

  onDesktopGalleryChange(galleryId: string): void {
    if (!this.permissionsService.canCaptureInGallery(galleryId)) {
      return;
    }

    this.desktopCaptureGalleryId.set(galleryId);
    this.galleryService.selectGallery(galleryId);
    this.captureMode.set('selected');
  }

  openGalleryCreationDialogForMobileCapture(): void {
    if (!this.canCreateGalleries()) {
      return;
    }

    this.assignNextGalleryToMobileCapture = true;
    this.openGalleryCreationDialog();
  }

  async onCaptureComplete(imageUrl: string): Promise<void> {
    const selectedGalleryId = this.galleryService.selectedGalleryId();

    if (!selectedGalleryId) {
      this.galleryService.addPendingCapture(imageUrl);
      this.lastCapturedImage.set(imageUrl);
      return;
    }

    const success = await this.galleryService.addImageToGallery(selectedGalleryId, imageUrl);
    if (!success) {
      this.notifyGalleryError();
      return;
    }
    this.lastCapturedImage.set(imageUrl);
  }

  async assignPendingToGallery(galleryId: string, imageUrl?: string): Promise<void> {
    const targetImage = imageUrl ?? this.selectedPendingCapture();
    if (!targetImage) {
      return;
    }

    const success = await this.galleryService.assignPendingCaptureToGallery(galleryId, targetImage);
    if (!success) {
      this.notifyGalleryError();
      return;
    }
    this.lastCapturedImage.set(targetImage);
    if (this.pendingCaptureToAssign() === targetImage) {
      this.pendingCaptureToAssign.set(null);
    }
  }

  discardPendingCapture(imageUrl: string): void {
    this.galleryService.removePendingCapture(imageUrl);
    if (this.pendingCaptureToAssign() === imageUrl) {
      this.pendingCaptureToAssign.set(null);
    }
  }

  onPendingGallerySelect(event: Event, imageUrl: string): void {
    const selectElement = event.target as HTMLSelectElement;
    const galleryId = selectElement.value;
    if (!galleryId) {
      return;
    }

    this.assignPendingToGallery(galleryId, imageUrl);
    selectElement.value = '';
  }

  getGalleryCover(gallery: Gallery): string {
    if (gallery.thumbnailUrl) {
      return gallery.thumbnailUrl;
    }
    if (gallery.imageUrls && gallery.imageUrls.length > 0) {
      return gallery.imageUrls[0];
    }
    return 'https://via.placeholder.com/800x800?text=Galeria';
  }

  private handleMobileNavigationTransition(): void {
    if (!this.isMobileLayout()) {
      return;
    }

    this.mobileCommandPanelVisible.set(false);
    this.scheduleMobilePanelReveal(500);
    this.resetMobileScrollPosition();
  }

  trackMobileGallery(_index: number, gallery: Gallery): string {
    return gallery.id;
  }

  trackMobileImage(index: number, imageUrl: string): string {
    return `${index}-${imageUrl}`;
  }

  trackPendingCapture(index: number, imageUrl: string): string {
    return `${index}-${imageUrl}`;
  }

  private updateVisibleItems(force: boolean = false): void {
    let itemsToDisplay: (string | Gallery)[] = [];
    let isGalleryView = false;

    if (this.currentView() === 'galleries') {
      itemsToDisplay = this.galleryService.galleries();
      isGalleryView = true;
    } else {
      itemsToDisplay = this.images(); // This is already a computed signal from selected gallery
    }

    if (itemsToDisplay.length === 0) {
      this.visibleItems.set([]);
      return;
    }

    const newGridPosition = {
      x: Math.round(this.current.x / 100),
      y: Math.round(this.current.y / 100),
    };

    if (!force && this.lastGridPosition.x === newGridPosition.x && this.lastGridPosition.y === newGridPosition.y) {
      return;
    }
    this.lastGridPosition = newGridPosition;

    if (this.viewport.width === 0 || this.viewport.height === 0) {
      this.calculateGridDimensions();
      this.updateTeleportationAnchors();
    }

    const viewWidth = this.viewport.width;
    const viewHeight = this.viewport.height;

    if (viewWidth === 0 || viewHeight === 0) {
      return;
    }

    const startCol = Math.floor((-this.current.x) / this.itemDimensions.cellWidth - this.settings.bufferZone);
    const endCol = Math.ceil((-this.current.x + viewWidth) / this.itemDimensions.cellWidth + this.settings.bufferZone);
    const startRow = Math.floor((-this.current.y) / this.itemDimensions.cellHeight - this.settings.bufferZone);
    const endRow = Math.ceil((-this.current.y + viewHeight) / this.itemDimensions.cellHeight + this.settings.bufferZone);

    const newVisibleItems: VisibleItem[] = [];
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const wrappedIndex = this.getWrappedIndex(row * this.numColumns() + col, itemsToDisplay.length);
        const currentItem = itemsToDisplay[wrappedIndex];
        const creationOrder = this.calculateCreationOrder(itemsToDisplay.length, wrappedIndex);

        if (isGalleryView) {
          const gallery = currentItem as Gallery;
          const previewKey = `${gallery.id}-${col}-${row}`;
          newVisibleItems.push({
            type: 'gallery',
            id: gallery.id,
            name: gallery.name,
            description: gallery.description,
            thumbnailUrl: gallery.thumbnailUrl || FALLBACK_GALLERY_THUMBNAIL,
            imageUrls: gallery.imageUrls,
            imageCount: gallery.imageUrls.length,
            createdAt: gallery.createdAt,
            x: col * this.itemDimensions.cellWidth,
            y: row * this.itemDimensions.cellHeight,
            width: this.itemDimensions.width,
            height: this.itemDimensions.height,
            col,
            row,
            creationOrder,
            previewKey,
          });
        } else {
          const imageUrl = currentItem as string;
          newVisibleItems.push({
            type: 'photo',
            id: `${col},${row}`,
            url: imageUrl,
            x: col * this.itemDimensions.cellWidth,
            y: row * this.itemDimensions.cellHeight,
            width: this.itemDimensions.width,
            height: this.itemDimensions.height,
            col,
            row,
            creationOrder,
          });
        }
      }
    }
    this.visibleItems.set(newVisibleItems);

    if (isGalleryView && !this.isAutoNavigationActive()) {
      const visiblePreviewKeys = new Set(
        newVisibleItems
          .filter((item): item is GalleryCardItem => item.type === 'gallery')
          .map(item => item.previewKey)
      );
      for (const key of Array.from(this.galleryPreviewTimers.keys())) {
        if (!visiblePreviewKeys.has(key)) {
          this.clearGalleryPreviewTimers(key);
          this.setGalleryPreviewImage(key, null);
        }
      }
    }
  }

  private getWrappedIndex(index: number, length: number): number {
    if (length <= 0) {
      return 0;
    }

    const normalizedIndex = index % length;
    return normalizedIndex < 0 ? normalizedIndex + length : normalizedIndex;
  }

  private calculateCreationOrder(totalItems: number, index: number): number {
    if (totalItems <= 0) {
      return 0;
    }
    return totalItems - index;
  }

  onGalleryHoverStart(galleryId: string, previewKey: string): void {
    if (this.isAutoNavigationActive()) {
      return;
    }

    const gallery = this.galleryService.getGallery(galleryId);
    if (!gallery || gallery.imageUrls.length === 0) {
      return;
    }

    this.clearGalleryPreviewTimers(previewKey);

    const imageUrls = gallery.imageUrls;
    if (imageUrls.length > 0) {
      this.setGalleryPreviewImage(previewKey, imageUrls[0]);
      if (imageUrls.length === 1) {
        this.galleryPreviewTimers.set(previewKey, { startTimeoutId: null, intervalId: null });
        return;
      }

      const startTimeoutId = setTimeout(() => {
        this.ngZone.run(() => this.startPreviewForGallery(galleryId, previewKey));
      }, this.GALLERY_PREVIEW_DELAY);
      this.galleryPreviewTimers.set(previewKey, { startTimeoutId, intervalId: null });
    }
  }

  onGalleryHoverEnd(previewKey: string): void {
    this.clearGalleryPreviewTimers(previewKey);
    this.setGalleryPreviewImage(previewKey, null);
  }

  private startPreviewForGallery(galleryId: string, previewKey: string): void {
    const gallery = this.galleryService.getGallery(galleryId);
    if (!gallery || gallery.imageUrls.length === 0) {
      return;
    }

    this.clearGalleryPreviewTimers(previewKey);

    // Start the preview immediately without delay
    const activeGallery = this.galleryService.getGallery(galleryId);
    const imageUrls = activeGallery?.imageUrls ?? [];
    if (imageUrls.length === 0) {
      this.onGalleryHoverEnd(previewKey);
      return;
    }

    if (imageUrls.length === 1) {
      this.setGalleryPreviewImage(previewKey, imageUrls[0]);
      this.galleryPreviewTimers.delete(previewKey);
      return;
    }

    let currentIndex = 0;
    const updateImage = () => {
      const refreshedGallery = this.galleryService.getGallery(galleryId);
      const urls = refreshedGallery?.imageUrls ?? imageUrls;
      if (urls.length === 0) {
        this.onGalleryHoverEnd(previewKey);
        return;
      }
      if (currentIndex >= urls.length) {
        currentIndex = 0;
      }
      this.setGalleryPreviewImage(previewKey, urls[currentIndex]);
      currentIndex = (currentIndex + 1) % urls.length;
    };

    updateImage();
    const intervalId = setInterval(() => {
      updateImage();
    }, this.GALLERY_PREVIEW_INTERVAL);

    this.galleryPreviewTimers.set(previewKey, { startTimeoutId: null, intervalId });
  }

  private setGalleryPreviewImage(previewKey: string, imageUrl: string | null): void {
    this.galleryPreviewImages.update(current => {
      const next = { ...current };
      if (imageUrl) {
        next[previewKey] = imageUrl;
      } else {
        delete next[previewKey];
      }
      return next;
    });
  }

  private clearGalleryPreviewTimers(previewKey: string): void {
    const timers = this.galleryPreviewTimers.get(previewKey);
    if (!timers) {
      return;
    }

    if (timers.startTimeoutId) {
      clearTimeout(timers.startTimeoutId);
    }
    if (timers.intervalId) {
      clearInterval(timers.intervalId);
    }

    this.galleryPreviewTimers.delete(previewKey);
  }

  private stopAllGalleryPreviews(): void {
    const previewKeys = Array.from(this.galleryPreviewTimers.keys());
    for (const key of previewKeys) {
      this.clearGalleryPreviewTimers(key);
    }
    this.galleryPreviewImages.set({});
  }

  private startAnimationLoop(): void {
    this.ngZone.runOutsideAngular(() => {
      const animate = () => {
        if (!this.isMobileLayout()) {
          if (this.isAutoNavigationActive()) {
            // Atualiza o ângulo para percorrer a elipse
            this.idleEllipseAngle += this.idleSpeed;

            // Calcula a posição na elipse usando funções trigonométricas
            // x = centerX + radiusX * cos(angle)
            // y = centerY + radiusY * sin(angle)
            this.target.x = this.idleEllipseCenter.x + this.idleEllipseRadiusX * Math.cos(this.idleEllipseAngle);
            this.target.y = this.idleEllipseCenter.y + this.idleEllipseRadiusY * Math.sin(this.idleEllipseAngle);
          } else if (this.isInteractionEnabled()) {
            const { deltaX: edgeDeltaX, deltaY: edgeDeltaY } = this.calculateEdgeScroll();
            const { deltaX: keyboardDeltaX, deltaY: keyboardDeltaY } = this.calculateKeyboardScroll();
            const combinedDeltaX = edgeDeltaX + keyboardDeltaX;
            const combinedDeltaY = edgeDeltaY + keyboardDeltaY;
            if (combinedDeltaX !== 0 || combinedDeltaY !== 0) {
              this.target.x += combinedDeltaX;
              this.target.y += combinedDeltaY;
            }
          }

          const shouldUpdatePosition = this.isAutoNavigationActive() || this.isInteractionEnabled();

          if (shouldUpdatePosition) {
            this.current.x += (this.target.x - this.current.x) * this.settings.dragEase;
            this.current.y += (this.target.y - this.current.y) * this.settings.dragEase;

            this.applyTeleportation();

            const wrapperRef = this.canvasWrapper();
            if (wrapperRef) {
              wrapperRef.nativeElement.style.transform = `translate(${this.current.x}px, ${this.current.y}px)`;
            }

            this.updateVisibleItems();
          }
        }
        this.animationFrameId = requestAnimationFrame(animate);
      };
      animate();
    });
  }

  private runExpandAnimation(element: HTMLElement, item: ExpandedItem): void {
    const maxWidth = window.innerWidth * 0.9;
    const maxHeight = window.innerHeight * 0.9;
    const aspectRatio =
      item.originalWidth > 0 && item.originalHeight > 0
        ? item.originalWidth / item.originalHeight
        : 1;

    let targetWidth = maxWidth;
    let targetHeight = maxWidth / aspectRatio;

    if (targetHeight > maxHeight) {
      targetHeight = maxHeight;
      targetWidth = maxHeight * aspectRatio;
    }

    const startX = item.originalRect.left + item.originalWidth / 2 - window.innerWidth / 2;
    const startY = item.originalRect.top + item.originalHeight / 2 - window.innerHeight / 2;

    element.getAnimations().forEach(animation => animation.cancel());

    element.style.width = `${item.originalWidth}px`;
    element.style.height = `${item.originalHeight}px`;
    element.style.transform = `translate(calc(-50% + ${startX}px), calc(-50% + ${startY}px))`;

    const animation = element.animate(
      [
        {
          width: `${item.originalWidth}px`,
          height: `${item.originalHeight}px`,
          transform: `translate(calc(-50% + ${startX}px), calc(-50% + ${startY}px))`,
        },
        {
          width: `${targetWidth}px`,
          height: `${targetHeight}px`,
          transform: 'translate(-50%, -50%)',
        },
      ],
      {
        duration: this.settings.zoomDuration * 1000,
        easing: HOP_EASING,
        fill: 'forwards',
      }
    );

    animation.finished
      .then(() => {
        element.style.width = `${targetWidth}px`;
        element.style.height = `${targetHeight}px`;
        element.style.transform = 'translate(-50%, -50%)';
      })
      .catch(() => {
        // A animação pode ser cancelada se uma nova começar imediatamente.
      });
  }

  editGallery(id: string): void {
    if (!this.permissionsService.canManageGalleryById(id)) {
      return;
    }

    this.deactivateAutoNavigation(true);
    const galleryToEdit = this.galleryService.getGallery(id);
    if (galleryToEdit) {
      this.editingGallery.set(galleryToEdit);
      this.isGalleryEditorVisible.set(true);
    }
  }

  onResize(): void {
    this.calculateGridDimensions();
    this.updateTeleportationAnchors();
    this.updateVisibleItems(true);
    this.updateResponsiveLayout();
    if (this.expandedItem()) {
      this.closeExpandedItem();
    }
  }

  zoomIn(): void {
    this.numColumns.update(n => Math.max(1, n - 1));
    this.onResize();
  }

  zoomOut(): void {
    this.numColumns.update(n => Math.min(8, n + 1));
    this.onResize();
  }

  private updateKeyboardScrollDirection(): void {
    const horizontal = (this.activeArrowKeys.has('ArrowLeft') ? 1 : 0) + (this.activeArrowKeys.has('ArrowRight') ? -1 : 0);
    const vertical = (this.activeArrowKeys.has('ArrowUp') ? 1 : 0) + (this.activeArrowKeys.has('ArrowDown') ? -1 : 0);

    this.keyboardScrollDirection.x = horizontal;
    this.keyboardScrollDirection.y = vertical;
  }

  onImageClick(event: MouseEvent, item: VisibleItem): void {
    if (!this.isInteractionEnabled()) return;

    if (item.type === 'gallery') {
      this.selectGallery(item.id);
    } else {
      this.expandItem(item, event.currentTarget as HTMLElement);
    }
  }



  expandItem(item: PhotoItem, element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    this.expandedItem.set({
      id: item.id,
      url: item.url,
      originalRect: rect,
      originalWidth: this.itemDimensions.width,
      originalHeight: this.itemDimensions.height,
    });
  }

  async handleGalleryCreate(event: { name: string; description: string }): Promise<void> {
    if (!this.canCreateGalleries()) {
      return;
    }

    const newGalleryId = await this.galleryService.createGallery(event.name, event.description);
    if (!newGalleryId) {
      this.notifyGalleryError();
      return;
    }

    this.isGalleryCreationDialogVisible.set(false);
    this.selectGallery(newGalleryId);
    if (this.assignNextGalleryToMobileCapture) {
      this.mobileCaptureGalleryId.set(newGalleryId);
      this.assignNextGalleryToMobileCapture = false;
    }
    this.updateVisibleItems(true); // Refresh the view
  }

  async handleGallerySave(event: { id: string | null; name: string; description: string }): Promise<void> {
    if (event.id) {
      if (!this.permissionsService.canManageGalleryById(event.id)) {
        return;
      }
      const success = await this.galleryService.updateGallery(event.id, event.name, event.description);
      if (!success) {
        this.notifyGalleryError();
        return;
      }
    } else {
      if (!this.canCreateGalleries()) {
        return;
      }
      const createdId = await this.galleryService.createGallery(event.name, event.description);
      if (!createdId) {
        this.notifyGalleryError();
        return;
      }

      if (this.assignNextGalleryToMobileCapture) {
        this.mobileCaptureGalleryId.set(createdId);
        this.assignNextGalleryToMobileCapture = false;
      }

      this.selectGallery(createdId);
    }
    this.isGalleryEditorVisible.set(false);
    this.editingGallery.set(null);
    this.updateVisibleItems(true); // Refresh the view
  }

  async handleGalleryDelete(id: string): Promise<void> {
    if (!this.permissionsService.canManageGalleryById(id)) {
      return;
    }

    const success = await this.galleryService.deleteGallery(id);
    if (!success) {
      this.notifyGalleryError();
      return;
    }
    this.isGalleryEditorVisible.set(false);
    this.editingGallery.set(null);
    this.updateVisibleItems(true); // Refresh the view
  }

  onRightClick(event: MouseEvent): void {
    event.preventDefault();
    const groups: ContextMenuGroup[] = [this.createGeneralGroup()];

    if (this.currentView() === 'galleries' && this.canCreateGalleries()) {
      groups.push({ label: 'Galerias', actions: ['createGallery'] });
    } else if (this.currentView() === 'photos' && this.canUseCaptureDialog()) {
      groups.push({ label: 'Fotos', actions: ['capturePhoto'] });
    }

    this.contextMenu.set({ visible: true, x: event.clientX, y: event.clientY, groups });
    this.contextMenuPhotoUrl = null;
    this.contextMenuGalleryId = null;
  }

  onGalleryRightClick(event: MouseEvent, galleryId: string): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.currentView() === 'galleries') {
      const groups: ContextMenuGroup[] = [this.createGeneralGroup()];

      if (this.canCreateGalleries()) {
        groups.push({ label: 'Galerias', actions: ['createGallery'] });
      }

      if (this.permissionsService.canManageGalleryById(galleryId)) {
        groups.push({ label: 'Galeria selecionada', actions: ['togglePlayback', 'editGallery', 'deleteGallery'] });
      }

      this.contextMenu.set({ visible: true, x: event.clientX, y: event.clientY, groups });
      // Store the gallery ID for context menu actions
      this.contextMenuGalleryId = galleryId;
      this.contextMenuPhotoUrl = null;
    }
  }

  onPhotoRightClick(event: MouseEvent, photoUrl: string): void {
    if (this.isMobileLayout()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const groups: ContextMenuGroup[] = [this.createGeneralGroup(false)];

    if (this.canUseCaptureDialog()) {
      const photoActions: ContextMenuAction[] = this.canCaptureInSelectedGallery()
        ? ['capturePhoto', 'deletePhoto']
        : ['capturePhoto'];
      groups.push({ label: 'Fotos', actions: photoActions });
    }

    this.contextMenu.set({ visible: true, x: event.clientX, y: event.clientY, groups });
    this.contextMenuPhotoUrl = photoUrl;
    this.contextMenuGalleryId = null;
  }

  closeContextMenu(event?: MouseEvent): void {
    if (event) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('app-context-menu')) {
        return;
      }
    }

    this.contextMenu.set({ visible: false, x: 0, y: 0, groups: [] });
    this.contextMenuGalleryId = null;
    this.contextMenuPhotoUrl = null;
  }

  openWebcamCapture(): void {
    if (!this.canUseCaptureDialog()) {
      return;
    }

    const captureGalleryId = this.resolveCaptureTargetGallery();
    if (!captureGalleryId) {
      return;
    }

    this.galleryService.selectGallery(captureGalleryId);

    if (this.isMobileLayout()) {
      this.captureMode.set('selected');
      this.mobileCaptureGalleryId.set(captureGalleryId);
      this.showMobileCapture();
      return;
    }

    this.desktopCaptureGalleryId.set(captureGalleryId);
    this.captureMode.set('selected');
    this.deactivateAutoNavigation(true);
    this.isWebcamVisible.set(true);
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  onFullscreenChange(): void {
    this.isFullscreen.set(!!document.fullscreenElement);
  }

  updateTime(): void {
    const now = new Date();
    this.currentTime.set(now.toLocaleTimeString('pt-BR'));
  }

  updateDate(): void {
    const now = new Date();
    this.currentDate.set(now.toLocaleDateString('pt-BR'));
  }

  selectGallery(id: string): void {
    this.deactivateAutoNavigation(true);
    this.stopAllGalleryPreviews();
    this.galleryService.selectGallery(id);
    this.currentView.set('photos');
    this.handleMobileNavigationTransition();
  }

  async deleteGallery(id: string): Promise<void> {
    if (!this.permissionsService.canManageGalleryById(id)) {
      return;
    }

    const activeGallery = this.galleryService.selectedGalleryId();
    const success = await this.galleryService.deleteGallery(id);
    if (!success) {
      this.notifyGalleryError();
      return;
    }

    if (activeGallery === id) {
      this.backToGalleries();
    }

    this.updateVisibleItems(true);
  }

  async deletePhotoByUrl(photoUrl: string): Promise<void> {
    if (!this.canDeletePhoto()) {
      return;
    }

    const activeGalleryId = this.galleryService.selectedGalleryId();
    if (!activeGalleryId) {
      return;
    }

    if (!this.confirmPhotoDeletion()) {
      return;
    }

    const success = await this.galleryService.removeImageFromGallery(activeGalleryId, photoUrl);
    if (!success) {
      this.notifyGalleryError();
      return;
    }
    this.updateVisibleItems(true);

    if (this.expandedItem()?.url === photoUrl) {
      this.closeExpandedItem();
    }
  }

  private confirmPhotoDeletion(): boolean {
    return window.confirm('Tem certeza que deseja excluir esta foto? Esta ação não pode ser desfeita.');
  }

  editGalleryContextMenu(): void {
    if (!this.permissionsService.canManageGalleryById(this.contextMenuGalleryId)) {
      return;
    }

    if (this.contextMenuGalleryId) {
      this.editGallery(this.contextMenuGalleryId);
    }
  }

  deleteGalleryContextMenu(): void {
    if (!this.permissionsService.canManageGalleryById(this.contextMenuGalleryId)) {
      return;
    }

    if (this.contextMenuGalleryId) {
      this.deleteGallery(this.contextMenuGalleryId);
    }
  }

  async deletePhotoContextMenu(): Promise<void> {
    if (!this.canDeletePhoto()) {
      return;
    }

    if (!this.contextMenuPhotoUrl) {
      return;
    }

    await this.deletePhotoByUrl(this.contextMenuPhotoUrl);
    this.contextMenuPhotoUrl = null;
  }

  openGalleryCreationDialog(): void {
    if (!this.canCreateGalleries()) {
      return;
    }

    this.deactivateAutoNavigation(true);
    this.isGalleryCreationDialogVisible.set(true);
  }

  toggleInfoDialog(): void {
    this.deactivateAutoNavigation(true);
    this.isInfoDialogVisible.update(visible => !visible);
  }

  async createGalleryWithTimestamp(): Promise<void> {
    if (!this.canCreateGalleries()) {
      return;
    }

    // Create a gallery with current timestamp as the name in the expected format
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const timestamp = `${day}/${month}/${year} às ${hours}:${minutes}:${seconds}`;
    const galleryName = `Galeria ${timestamp}`;

    const createdId = await this.galleryService.createGallery(galleryName, 'Galeria criada automaticamente');
    if (!createdId) {
      this.notifyGalleryError();
      return;
    }

    this.selectGallery(createdId);
    this.updateVisibleItems(true); // Refresh the view
  }

  backToGalleries(): void {
    this.deactivateAutoNavigation(true);
    this.stopAllGalleryPreviews();
    this.galleryService.selectGallery(null);
    this.currentView.set('galleries');
    this.handleMobileNavigationTransition();
  }

  closeExpandedItem(): void {
    const element = this.expandedItemElement();
    if (element && this.expandedItem()) {
      const item = this.expandedItem()!;
      const nativeElement = element.nativeElement;
      const rect = nativeElement.getBoundingClientRect();
      const currentWidth = rect.width;
      const currentHeight = rect.height;
      const currentX = rect.left + rect.width / 2 - window.innerWidth / 2;
      const currentY = rect.top + rect.height / 2 - window.innerHeight / 2;
      const targetX = item.originalRect.left + item.originalWidth / 2 - window.innerWidth / 2;
      const targetY = item.originalRect.top + item.originalHeight / 2 - window.innerHeight / 2;

      nativeElement.getAnimations().forEach(animation => animation.cancel());

      nativeElement.style.width = `${currentWidth}px`;
      nativeElement.style.height = `${currentHeight}px`;
      nativeElement.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`;

      const animation = nativeElement.animate(
        [
          {
            width: `${currentWidth}px`,
            height: `${currentHeight}px`,
            transform: `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`,
          },
          {
            width: `${item.originalWidth}px`,
            height: `${item.originalHeight}px`,
            transform: `translate(calc(-50% + ${targetX}px), calc(-50% + ${targetY}px))`,
          },
        ],
        {
          duration: 600,
          easing: HOP_EASING,
          fill: 'forwards',
        }
      );

      animation.finished
        .then(() => {
          nativeElement.style.width = `${item.originalWidth}px`;
          nativeElement.style.height = `${item.originalHeight}px`;
          nativeElement.style.transform = `translate(calc(-50% + ${targetX}px), calc(-50% + ${targetY}px))`;
        })
        .catch(() => {
          // A animação pode ser cancelada se uma nova começar imediatamente.
        })
        .finally(() => {
          this.expandedItem.set(null);
        });
    } else {
      this.expandedItem.set(null);
    }
  }
  private notifyGalleryError(): void {
    const message = this.galleryService.lastErrorMessage();
    if (message) {
      console.warn(message);
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(message);
      }
    }
  }

  trackById(index: number, item: VisibleItem): string {
    if (item.type === 'gallery') {
      return item.previewKey;
    }
    return item.id;
  }
}