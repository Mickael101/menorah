<script setup lang="ts">
import { ref } from 'vue';
import { useAdminI18n } from '../composables/useAdminI18n';

// Ecran de connexion qui remplace window.prompt (contrat § Routage frontend) :
// champ de code, soiree nommee, message d'erreur explicite. La distinction
// 401/403 est fonctionnelle : un 403 dit « code valide mais pas pour cette
// soiree », pour qu'un operateur qui saisit le code de la soiree A sur la
// soiree B comprenne POURQUOI c'est refuse.
const props = defineProps<{
  eventName: string | null;
  error: '401' | '403' | 'generic' | null;
  checking: boolean;
}>();

const emit = defineEmits<{ (e: 'submit', code: string): void }>();

const { t, direction, locale, setLocale } = useAdminI18n();
const availableLocales = ['fr', 'en', 'he'] as const;
const code = ref('');
// Les codes de soiree sont longs et sensibles a la casse : sans bascule de
// visibilite, une faute de frappe est indistinguable d'un code perime.
const revealCode = ref(false);

const errorMessage = (): string => {
  if (props.error === '401') return t('auth.error401');
  if (props.error === '403') return t('auth.error403');
  if (props.error === 'generic') return t('auth.errorGeneric');
  return '';
};

function submit(): void {
  const value = code.value.trim();
  if (!value || props.checking) return;
  emit('submit', value);
}
</script>

<template>
  <div class="login-screen" :dir="direction" :lang="locale">
    <div class="login-card">
      <div class="login-langs">
        <button
          v-for="lang in availableLocales"
          :key="lang"
          type="button"
          class="lang-btn"
          :class="{ active: locale === lang }"
          @click="setLocale(lang)"
        >
          {{ t(`language.short.${lang}`) }}
        </button>
      </div>

      <div class="login-flame" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2c0 4-5 5.5-5 10a5 5 0 0 0 10 0c0-1.5-.5-2.7-1.2-3.8C15.2 9.8 14 11 14 12.5c0 0-2-1.6-2-4.5 0-2.4 0-4.5 0-6z"/>
        </svg>
      </div>

      <h1 class="login-title">{{ t('auth.loginTitle') }}</h1>
      <p v-if="eventName" class="login-event">
        <span class="login-event-label">{{ t('auth.eventLabel') }}</span>
        <span class="login-event-name" dir="auto">{{ eventName }}</span>
      </p>

      <form class="login-form" @submit.prevent="submit">
        <label for="admin-code">{{ t('auth.codeLabel') }}</label>
        <div class="code-field">
          <input
            id="admin-code"
            v-model="code"
            :type="revealCode ? 'text' : 'password'"
            autocomplete="current-password"
            spellcheck="false"
            :placeholder="t('auth.codePlaceholder')"
            :disabled="checking"
          />
          <button
            type="button"
            class="reveal-btn"
            :aria-label="revealCode ? t('auth.hideCode') : t('auth.showCode')"
            :aria-pressed="revealCode"
            @click="revealCode = !revealCode"
          >
            <svg v-if="revealCode" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>

        <p v-if="error" class="login-error" role="alert">{{ errorMessage() }}</p>

        <button type="submit" class="login-submit" :disabled="checking || !code.trim()">
          {{ checking ? t('auth.checking') : t('auth.submit') }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-screen {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: radial-gradient(ellipse at top, #131731 0%, #070914 60%);
  color: #f7f3ea;
  box-sizing: border-box;
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(228, 190, 99, 0.22);
  border-radius: 18px;
  padding: 28px 24px 26px;
  backdrop-filter: blur(12px);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  text-align: center;
}

.login-langs {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-bottom: 6px;
}

.lang-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(228, 190, 99, 0.25);
  color: rgba(247, 243, 234, 0.7);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.lang-btn.active {
  background: rgba(228, 190, 99, 0.2);
  border-color: #e4be63;
  color: #f2cc72;
}

.login-flame {
  width: 54px;
  height: 54px;
  margin: 4px auto 14px;
  border-radius: 50%;
  background: linear-gradient(160deg, rgba(228, 190, 99, 0.25), rgba(228, 190, 99, 0.05));
  border: 1px solid rgba(228, 190, 99, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f2cc72;
}

.login-flame svg {
  width: 28px;
  height: 28px;
}

.login-title {
  font-size: 22px;
  margin: 0 0 6px;
  color: #f2cc72;
}

.login-event {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0 0 20px;
}

.login-event-label {
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: rgba(242, 204, 114, 0.7);
}

.login-event-name {
  font-size: 16px;
  font-weight: 700;
  color: #f7f3ea;
}

.login-form {
  text-align: start;
}

.login-form label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: rgba(242, 204, 114, 0.85);
  margin-bottom: 7px;
}

.code-field {
  position: relative;
}

.login-form input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(7, 9, 20, 0.6);
  border: 1.5px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  color: #f7f3ea;
  padding: 13px 14px;
  padding-inline-end: 46px; /* place pour la bascule de visibilite */
  font-size: 15px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.reveal-btn {
  position: absolute;
  inset-block: 0;
  inset-inline-end: 6px;
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 8px;
  color: rgba(242, 204, 114, 0.75); /* 7.33:1 sur le fond composite du champ, calcule (node, couches composees) */
  cursor: pointer;
}

.reveal-btn:hover,
.reveal-btn:focus-visible {
  color: #f2cc72;
  outline: none;
  background: rgba(228, 190, 99, 0.12);
}

.reveal-btn svg {
  width: 20px;
  height: 20px;
}

.login-form input:focus {
  outline: none;
  border-color: #e4be63;
  box-shadow: 0 0 0 4px rgba(228, 190, 99, 0.12);
}

.login-error {
  background: rgba(220, 60, 60, 0.15);
  border: 1px solid rgba(220, 60, 60, 0.4);
  color: #ff9d9d;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  margin: 14px 0 0;
}

.login-submit {
  width: 100%;
  margin-top: 18px;
  background: linear-gradient(135deg, #e4be63 0%, #c8922a 100%);
  color: #131731;
  border: none;
  border-radius: 12px;
  padding: 15px;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s;
  box-shadow: 0 8px 26px rgba(228, 190, 99, 0.35);
}

.login-submit:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(228, 190, 99, 0.5);
}

.login-submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
