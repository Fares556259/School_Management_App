export type HniaOutputLanguage = 'fr' | 'en' | 'ar';
export const outputText = (language: string | undefined, fr: string, en: string, ar: string) => language === 'ar' ? ar : language === 'en' ? en : fr;

export function outputLanguageInstruction(language?: string) {
  return outputText(language,
    'LANGUE DE SORTIE OBLIGATOIRE : français professionnel. Comprends le tunisien, le derja et l’Arabizi en entrée, mais ne les reproduis pas dans tes réponses. Réponds uniquement en français, sans mélanger les langues.',
    'MANDATORY OUTPUT LANGUAGE: professional English. Understand Tunisian Arabic, Derja and Arabizi as input, but reply only in English. Do not mix languages or mirror the input dialect.',
    'لغة الإجابة الإلزامية: العربية الفصحى المهنية حصراً. افهم اللهجة التونسية والعربيزي في رسائل المستخدم، وأجب بالعربية الفصحى دون استعمال اللهجة أو المزج بين اللغات.');
}

export function proposalMessage(language?: string, missingAmount = false) {
  return missingAmount
    ? outputText(language,
      'Précisez le montant reçu avec le bouton Modifier, puis vérifiez et confirmez la proposition. Aucun paiement n’a été enregistré.',
      'Enter the amount received using Edit, then review and confirm the proposal. No payment has been recorded.',
      'يرجى إدخال المبلغ المستلم باستخدام زر «تعديل»، ثم مراجعة المقترح وتأكيده. لم يُسجَّل أي دفع بعد.')
    : outputText(language,
      'Vérifiez les détails de la proposition, puis appuyez sur Confirmer pour l’enregistrer.',
      'Review the proposal details, then press Confirm to record it.',
      'يرجى مراجعة تفاصيل المقترح، ثم الضغط على «تأكيد» لتسجيله.');
}

export function claimsUnbackedAction(text: string) {
  return /(?:proposition.{0,70}(?:paiement|enregistrement|dépense)|(?:vérifi\w*|confirm\w*)[^\n]{0,100}(?:ci-dessous|below)|(?:prepared|created|recorded|saved).{0,60}(?:proposal|payment|expense)|(?:تم|حضرتلك).{0,40}(?:تسجيل|اقتراح|الدفع)|(?:اضغط|اضغطوا).{0,20}تأكيد)/i.test(text);
}
