/** Charge un fragment HTML séparé du JavaScript, puis le place dans le conteneur. */
export async function chargerFragment(conteneur, nomFichier) {
  const reponse = await fetch(new URL(`./${nomFichier}`, import.meta.url));
  if (!reponse.ok) {
    throw new Error(`Impossible de charger l’interface ${nomFichier} (${reponse.status}).`);
  }
  const modele = document.createElement("template");
  modele.innerHTML = await reponse.text();
  conteneur.replaceChildren(modele.content.cloneNode(true));
}
