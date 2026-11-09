/**
 * RadQuizz — crée le Google Form de réponse (cas radiologiques).
 *
 * 1. Ouvrez https://script.google.com et cliquez sur « Nouveau projet ».
 * 2. Effacez le code par défaut, collez ce fichier entier.
 * 3. Cliquez sur « Exécuter » (autorisez le script la première fois).
 * 4. Ouvrez « Journal d'exécution » en bas et copiez le bloc JSON.
 * 5. Collez-le dans content/form.json du projet.
 *
 * Ensuite, dans le formulaire : Réponses → Associer à une feuille de calcul.
 */
function createRadQuizzForm() {
  var form = FormApp.create('RadQuizz — cas radiologiques');
  form.setDescription('Un diagnostic, puis vos coordonnées. Deux minutes suffisent.');
  form.setCollectEmail(false);
  form.setConfirmationMessage('Merci ! Votre réponse a bien été enregistrée.');

  form.addParagraphTextItem().setTitle('Diagnostic').setRequired(true);

  form.addTextItem().setTitle('Nom et prénom').setRequired(true);

  form.addTextItem().setTitle('Email').setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());

  form.addMultipleChoiceItem().setTitle('Statut')
    .setChoiceValues(['Junior', 'Senior'])
    .setRequired(true);

  var caseItem = form.addTextItem()
    .setTitle('Cas (prérempli — ne pas modifier)')
    .setRequired(false);

  var pidItem = form.addTextItem()
    .setTitle('ID participant (prérempli — ne pas modifier)')
    .setRequired(false);

  // L'URL intégrée utilise l'identifiant *publié* (1FAIpQLS…), pas celui de l'édition :
  // c'est celui que assets/app.js attend dans content/form.json.
  var published = form.getPublishedUrl();          // …/forms/d/e/<ID>/viewform
  var formId = published.split('/d/e/')[1].split('/')[0];

  // Les clés « cas » et « participant » sont celles lues par assets/app.js.
  // Une réponse peut être envoyée plusieurs fois : pas de limite par participant.
  var config = {
    formId: formId,
    entries: {
      cas: 'entry.' + caseItem.getId(),
      participant: 'entry.' + pidItem.getId()
    }
  };

  Logger.log('Édition :  ' + form.getEditUrl());
  Logger.log('Réponses : ' + published);
  Logger.log('');
  Logger.log('--- à coller dans content/form.json ---');
  Logger.log(JSON.stringify(config, null, 2));
  Logger.log('---------------------------------------');

  return config;
}
