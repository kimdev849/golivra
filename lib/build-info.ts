/**
 * Marqueur de build affiché en bas de l'écran de connexion.
 *
 * Il permet de vérifier d'un coup d'œil quelle version du code tourne
 * réellement sur l'appareil :
 *  - si le marqueur n'apparaît pas (ou est plus ancien), l'app utilise
 *    encore un ancien bundle (il faut `eas update` / un nouveau build) ;
 *  - s'il affiche le marqueur courant, la version est bien à jour.
 *
 * ➜ Incrémentez `CODE_MARKER` à chaque évolution d'interface significative.
 */
export const CODE_MARKER = 'B18';

export const BUILD_LABEL = `GoLivra · build ${CODE_MARKER}`;
