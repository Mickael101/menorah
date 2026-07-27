import type { AdminLocale } from '../composables/useAdminI18n';

// Libelles propres a la galerie de themes. useAdminI18n vit dans composables/
// (hors perimetre de cette tranche) : plutot que d'y ajouter des cles, on tient
// un petit dictionnaire ici, choisi par la MEME locale (t() du panneau reste la
// source pour tout ce qui existait deja). Textes sobres, aucun contenu editorial.
const STRINGS: Record<AdminLocale, Record<string, string>> = {
  fr: {
    'gallery.builtin': 'Intégré',
    'gallery.custom': 'Personnalisé',
    'gallery.offline': 'Thèmes hors ligne : l’API est injoignable, l’écran garde son thème actuel.',
    'gallery.contrastWarning': 'Contraste sous le seuil AA',
    'gallery.duplicate': 'Dupliquer',
    'gallery.saveInto': 'Enregistrer dans ce thème',
    'gallery.delete': 'Supprimer',
    'gallery.export': 'Exporter (JSON)',
    'gallery.import': 'Importer (JSON)',
    'gallery.namePlaceholder': 'Nom du nouveau thème',
    'gallery.create': 'Créer le thème',
    'gallery.appliedHint': 'Appliqué à la soirée à l’enregistrement.',
    'gallery.deleteConfirm': 'Supprimer ce thème personnalisé ?',
    'gallery.savedTheme': 'Thème enregistré',
    'gallery.createdTheme': 'Thème créé',
    'gallery.deletedTheme': 'Thème supprimé',
    'gallery.importedTheme': 'Thème importé',
    'gallery.contrastRejected': 'Contraste AA insuffisant : {pairs}',
    'gallery.importSchemaError': 'Fichier de thème invalide : {reason}',
    'gallery.actionFailed': 'L’action a échoué'
  },
  en: {
    'gallery.builtin': 'Built-in',
    'gallery.custom': 'Custom',
    'gallery.offline': 'Offline themes: the API is unreachable, the screen keeps its current theme.',
    'gallery.contrastWarning': 'Contrast below AA threshold',
    'gallery.duplicate': 'Duplicate',
    'gallery.saveInto': 'Save into this theme',
    'gallery.delete': 'Delete',
    'gallery.export': 'Export (JSON)',
    'gallery.import': 'Import (JSON)',
    'gallery.namePlaceholder': 'New theme name',
    'gallery.create': 'Create theme',
    'gallery.appliedHint': 'Applied to the event on save.',
    'gallery.deleteConfirm': 'Delete this custom theme?',
    'gallery.savedTheme': 'Theme saved',
    'gallery.createdTheme': 'Theme created',
    'gallery.deletedTheme': 'Theme deleted',
    'gallery.importedTheme': 'Theme imported',
    'gallery.contrastRejected': 'Insufficient AA contrast: {pairs}',
    'gallery.importSchemaError': 'Invalid theme file: {reason}',
    'gallery.actionFailed': 'The action failed'
  },
  he: {
    'gallery.builtin': 'מובנה',
    'gallery.custom': 'מותאם אישית',
    'gallery.offline': 'מצב לא מקוון: ה-API אינו זמין, המסך שומר על ערכת הנושא הנוכחית.',
    'gallery.contrastWarning': 'ניגודיות מתחת לסף AA',
    'gallery.duplicate': 'שכפול',
    'gallery.saveInto': 'שמירה בערכה זו',
    'gallery.delete': 'מחיקה',
    'gallery.export': 'ייצוא (JSON)',
    'gallery.import': 'ייבוא (JSON)',
    'gallery.namePlaceholder': 'שם הערכה החדשה',
    'gallery.create': 'יצירת ערכה',
    'gallery.appliedHint': 'מוחל על הערב בעת השמירה.',
    'gallery.deleteConfirm': 'למחוק ערכת נושא מותאמת זו?',
    'gallery.savedTheme': 'הערכה נשמרה',
    'gallery.createdTheme': 'הערכה נוצרה',
    'gallery.deletedTheme': 'הערכה נמחקה',
    'gallery.importedTheme': 'הערכה יובאה',
    'gallery.contrastRejected': 'ניגודיות AA לא מספקת: {pairs}',
    'gallery.importSchemaError': 'קובץ ערכה לא תקין: {reason}',
    'gallery.actionFailed': 'הפעולה נכשלה'
  }
};

export function galleryText(
  locale: AdminLocale,
  key: string,
  params: Record<string, string | number> = {}
): string {
  const template = STRINGS[locale]?.[key] ?? STRINGS.fr[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_m, name) => String(params[name] ?? `{${name}}`));
}
