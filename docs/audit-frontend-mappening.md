# Audit global du frontend Mappening

Date de l'audit : 2026-06-11

Contexte : le frontend fonctionne principalement avec des mocks et une persistance locale. Le backend n'est pas encore implemente, donc les constats ci-dessous distinguent les problemes bloquants avant integration API des ameliorations pouvant attendre.

## Synthese globale

Le frontend est deja organise par domaines (`auth`, `event`, `user`, `organization`, `admin`, `moderator`, `notification`) avec un dossier `shared` utile pour les composants UI, layouts, styles, stores et services. Les routes sont centralisees et le lint passe sans erreur.

L'etat actuel est fonctionnel pour une demonstration mockee, mais plusieurs choix risquent de compliquer l'arrivee du backend : un store global tres monolithique, une logique metier dispersee dans de gros composants, des validations dupliquees, des services API encore peu exploites, et un modele de roles/organisations qui melange compte `organization` et utilisateur organisateur.

Le point le plus important avant backend est de clarifier les contrats de donnees et de droits, puis d'extraire les operations mockees vers des services remplacables par de vraies API.

## Verifications effectuees

- Lecture de l'arborescence `frontend/src`, des routes, stores, mocks, types, composants, styles et services.
- Verification des tailles de fichiers et recherches de duplications courantes.
- Verification des imports/usages evidents pour reperer des fichiers non utilises.
- `npm --prefix frontend run lint` : OK, aucune erreur ESLint.
- `npm --prefix frontend run build` : non concluant. La commande echoue au chargement de Vite avec `spawn EPERM`, probablement lie au sandbox. La relance hors sandbox a été refusee par la limite d'usage, donc le build production Vite reste a confirmer localement.

## Points positifs

- Architecture par domaines lisible et globalement coherente.
- Routes centralisees dans `frontend/src/shared/constants/routes.ts`.
- Plusieurs composants UI partages existent deja : `Button`, `Input`, `Select`, `Textarea`, `CheckboxGroup`, feedbacks et layouts.
- Les mocks couvrent des cas utiles : comptes actifs/inactifs, moderation, signalements, favoris, historique, organisations valides/en attente, evenements actifs/inactifs/supprimes.
- Les formulaires d'authentification/profil utilisent React Hook Form + Zod.
- Les etats vides, toasts, confirmations et motifs de decision existent deja sur plusieurs workflows sensibles.

## Problemes prioritaires

### Critique

Aucun probleme critique applicatif n'a été confirme par le lint ou la lecture statique. Le build production reste toutefois a relancer hors sandbox avant livraison.

### Important

#### Store mock global trop centralise

Zones concernees :

- `frontend/src/shared/store/dataStore.ts:4`
- `frontend/src/shared/store/dataStore.ts:77`
- `frontend/src/shared/store/dataStore.ts:348`
- `frontend/src/shared/store/dataStore.ts:366`
- `frontend/src/shared/store/dataStore.ts:643`
- `frontend/src/shared/store/dataStore.ts:1130`

Probleme : `shared/store/dataStore.ts` importe les mocks, types et services de presque tous les domaines, puis contient les mutations metier : comptes, organisations, evenements, favoris, historique, notifications, moderation, reset password. Cela rend `shared` dependant des domaines et rendra le remplacement par API difficile.

Correction proposee : creer une couche `repositories` ou `services` par domaine (`authService`, `eventService`, `organizationService`, etc.) avec une implementation mock actuelle et une future implementation HTTP. Garder Zustand pour l'etat UI/session, mais sortir les regles metier et mutations de `shared`.

Avant backend : indispensable.

#### Permissions moderateur mockees mais non appliquees

Zones concernees :

- `frontend/src/domains/moderator/mocks/moderators.mock.ts:1`
- `frontend/src/domains/moderator/mocks/moderators.mock.ts:18`
- `frontend/src/app/Router.tsx:330`

Probleme : des profils moderateurs avec permissions existent (`review_events`, `manage_reports`, etc.), mais ils ne sont jamais utilises. Toute personne ayant le role `moderator` accede au dashboard complet et aux actions.

Correction proposee : brancher `moderatorProfilesMock` dans le store ou un hook `useModeratorPermissions`, puis filtrer les vues/actions selon les permissions. Prevoir le meme contrat cote backend.

Avant backend : important pour valider le modele RBAC.

#### Services API incomplets et peu utilises

Zones concernees :

- `frontend/src/domains/auth/api/auth.api.ts:13`
- `frontend/src/domains/event/api/events.api.ts:5`
- `frontend/src/domains/event/api/events.api.ts:30`
- `frontend/src/shared/api/weather/weather.service.ts:27`
- `frontend/src/shared/api/weather/weather.service.ts:42`
- `frontend/src/domains/notification/services/emailProviders.ts:23`
- `frontend/src/domains/notification/services/emailProviders.ts:65`

Probleme : les endpoints sont declares pour auth/events, mais l'app manipule surtout le store directement. La meteo appelle une API externe depuis le client. L'envoi email est simule cote frontend et indique lui-meme que Resend devrait passer par un backend.

Correction proposee : definir des contrats de services par domaine avec payloads explicites, erreurs normalisees, et modes `mock`/`http`. La meteo et l'email doivent etre designes comme integrations backend ou proxies, sauf decision produit contraire.

Avant backend : indispensable.

#### Validations dupliquees et contrats de formulaire disperses

Zones concernees :

- `frontend/src/domains/organization/utils/organizationWorkflow.ts:160`
- `frontend/src/domains/organization/utils/organizationWorkflow.ts:252`
- `frontend/src/domains/user/components/UserOrganizations.tsx:138`
- `frontend/src/domains/user/components/UserOrganizations.tsx:225`
- `frontend/src/domains/organization/components/OrganizationEventCreate.tsx:55`
- `frontend/src/domains/organization/components/OrganizationEventsManager.tsx:89`
- `frontend/src/domains/admin/components/AdminDashboardPanel.tsx:146`
- `frontend/src/domains/event/validations/.gitkeep`
- `frontend/src/domains/organization/validations/.gitkeep`

Probleme : les validations evenement/organisation sont reproduites dans plusieurs composants. Les dossiers `validations` event/organization restent vides, alors que les regles existent ailleurs. Les messages et champs obligatoires risquent de diverger.

Correction proposee : centraliser les schemas Zod event/organization et les reutiliser dans les formulaires, les services mock et les futurs adaptateurs API. Garder les validations metier transverses dans des utils testables.

Avant backend : indispensable.

#### Composants trop volumineux et trop metier

Zones concernees :

- `frontend/src/domains/moderator/components/ModeratorDashboardPanel.tsx:1` - environ 2205 lignes.
- `frontend/src/domains/admin/components/AdminDashboardPanel.tsx:1` - environ 1554 lignes.
- `frontend/src/domains/user/components/UserOrganizations.tsx:1` - environ 1048 lignes.
- `frontend/src/domains/event/components/EventHome.tsx:1` - environ 639 lignes.
- `frontend/src/domains/organization/components/OrganizationDetail.tsx:1` - environ 618 lignes.
- `frontend/src/domains/organization/components/OrganizationEventsManager.tsx:1` - environ 559 lignes.

Probleme : ces composants combinent selection de donnees, filtrage, tri, validation, mutations, notifications, modales et rendu. Cela freine les tests et rendra l'integration API fragile.

Correction proposee : extraire des hooks par workflow (`useAdminAccounts`, `useEventModeration`, `useOrganizationEvents`), des composants de liste/formulaire, et des helpers purs testes.

Avant backend : important pour les dashboards admin/moderation et les formulaires evenement.

#### Interaction favori dans une carte cliquable

Zones concernees :

- `frontend/src/domains/event/components/EventHome.tsx:427`
- `frontend/src/domains/event/components/EventHome.tsx:436`
- `frontend/src/domains/event/components/EventHome.tsx:476`
- `frontend/src/domains/event/components/FavoriteButton.tsx:34`
- `frontend/src/domains/event/components/ReportEventButton.tsx:100`

Probleme : les cartes evenement sont des `article` avec `role="button"` et un `onClick`. Le bouton de signalement stoppe la propagation, mais le bouton favori ne le fait pas. Cliquer sur le coeur peut donc aussi activer la carte, enregistrer l'historique et recentrer la carte.

Correction proposee : stopper `click` et `keydown` dans `FavoriteButton`, ou remplacer la carte cliquable par un vrai bouton/lien dedie distinct des actions internes.

Avant backend : a corriger rapidement, car c'est visible cote UX.

#### Modele roles/organisations a clarifier

Zones concernees :

- `frontend/src/domains/user/types/user.ts:1`
- `frontend/src/domains/organization/components/OrganizationSetupFlow.tsx:41`
- `frontend/src/domains/organization/components/OrganizationSetupFlow.tsx:121`
- `frontend/src/domains/user/components/UserOrganizations.tsx:317`
- `frontend/src/domains/auth/components/LoginForm.tsx:27`
- `frontend/src/shared/constants/routes.ts:40`

Probleme : l'app supporte a la fois des comptes de role `organization` et des comptes `user` rattaches comme organisateurs a des organisations. C'est riche, mais les droits ne viennent pas d'une seule source.

Correction proposee : documenter explicitement le modele backend attendu : `account`, `user_profile`, `organization`, `organization_membership`, roles globaux et permissions par organisation. Cote frontend, nommer les guards en consequence.

Avant backend : indispensable.

#### Modales accessibles incompletes

Zones concernees :

- `frontend/src/shared/components/forms/FormModal.tsx:24`
- `frontend/src/shared/components/forms/FormModal.tsx:36`
- `frontend/src/shared/components/forms/FormModal.tsx:58`
- `frontend/src/domains/notification/components/NotificationCenter.tsx:135`

Probleme : `FormModal` gere Escape et le scroll body, mais ne piege pas le focus, ne restaure pas le focus au declencheur et ne deplace pas le focus initial dans la modale. `NotificationCenter` affiche un `role="dialog"` sans comportement modal complet.

Correction proposee : ajouter focus trap/restauration, `aria-labelledby` quand un titre existe, et fermer le panneau notifications au clic exterieur/Escape.

Avant backend : important pour accessibilite.

### Moyen

#### Nommage et routes organisation ambigus

Zones concernees :

- `frontend/src/domains/organization/pages/OrganizationDashboard.tsx:1`
- `frontend/src/domains/organization/pages/OrganizationDashboard.tsx:4`
- `frontend/src/shared/constants/routes.ts:40`
- `frontend/src/app/Router.tsx:367`
- `frontend/src/app/Router.tsx:370`

Probleme : `OrganizationDashboard` rend en fait `OrganizationEventCreate`. Les routes `/organization` et `/organization/create` affichent le meme composant. Le nom `Dashboard` est trompeur.

Correction proposee : rediriger `/organization` vers `/organization/events` ou `/organization/profile`.

Avant backend : a clarifier.

#### Routes d'inscription redondantes

Zones concernees :

- `frontend/src/shared/constants/routes.ts:9`
- `frontend/src/shared/constants/routes.ts:10`
- `frontend/src/shared/constants/routes.ts:11`
- `frontend/src/domains/auth/pages/UserRegister.tsx:6`
- `frontend/src/domains/auth/pages/OrganizationRegister.tsx:6`

Probleme : `/register/user` et `/register/organization` existent mais redirigent vers `/register`. C'est acceptable pour compatibilite, mais redondant si le workflow unifie est definitif.

Correction proposee : supprimer ces routes inutilisées.

Peut attendre apres backend si documente.

#### Fallback 404 trop silencieux

Zone concernee :

- `frontend/src/app/Router.tsx:373`

Probleme : toute route inconnue redirige vers l'accueil. Cela masque les erreurs de navigation et rend les diagnostics plus difficiles.

Correction proposee : ajouter une page 404 simple avec retour accueil/connexion.

Peut attendre.

#### Styles metier dans `shared`

Zones concernees :

- `frontend/src/shared/styles/_data.scss:42`
- `frontend/src/shared/styles/_data.scss:70`
- `frontend/src/shared/styles/_cards.scss:4`
- `frontend/src/shared/styles/_cards.scss:93`
- `frontend/src/shared/styles/_cards.scss:98`

Probleme : `shared` contient des classes tres metier (`admin-*`, `event-card`, `organization-review`). Cela brouille la separation entre styles generiques et styles de domaine.

Correction proposee : garder dans `shared` uniquement les tokens, mixins et patterns neutres (`card`, `toolbar`, `status-badge`). Deplacer les styles admin/event/organization dans leurs domaines.

Peut attendre, mais a faire avant grosse croissance UI.

#### Copies UI et terminologie incoherentes

Zones concernees :

- `frontend/src/domains/event/components/EventHome.tsx:486`
- `frontend/src/domains/user/components/FavoritesList.tsx:32`
- `frontend/src/domains/user/components/UserOrganizations.tsx:625`
- `frontend/src/domains/user/components/UserOrganizations.tsx:627`
- `frontend/src/domains/organization/components/OrganizationEventsManager.tsx:324`
- `frontend/src/domains/notification/services/notificationFactory.ts:136`

Probleme : plusieurs textes sont generiques ou mixtes francais/anglais : "Bienvenue sur la page d'accueil", "Page de favoris", "organization", "evenement" sans accents. Certains messages sont tres techniques ("Cette action retire l'evenement du mock").

Correction proposee : centraliser les libelles sensibles ou au moins faire une passe de microcopy avant demo : "organisation", "evenement", "publie", "supprime", messages utilisateur sans mention de mock.

Peut attendre backend, mais a faire avant presentation.

#### `tsconfig.app.json` contient une entree suspecte

Zone concernee :

- `frontend/tsconfig.app.json:24`

Probleme : `include` contient `src/domains/organization/types/.ts`, probablement une faute de frappe. `src` couvre deja le code.

Correction proposee : remplacer par `["src"]` sauf besoin tres specifique.

Peut attendre, mais facile a corriger.

### Mineur

#### Fichiers ou composants probablement inutilises

Zones concernees :

- `frontend/src/shared/components/layout/Page.tsx:17`
- `frontend/src/shared/components/layout/Card.tsx:13`
- `frontend/src/shared/components/layout/PanelTabs.tsx:15`
- `frontend/src/domains/event/components/MapAutoCenter.tsx:11`
- `frontend/src/domains/event/api/events.api.ts:5`
- `frontend/src/domains/moderator/mocks/moderators.mock.ts:18`

Probleme : ces fichiers ne semblent pas importes dans l'etat actuel. `events.api.ts` est une preparation utile mais non branchee.

Correction proposee : supprimer les composants morts ou les integrer vraiment. Garder les fichiers API seulement si un plan clair de migration existe.

Peut attendre.

#### `.gitkeep` obsoletes

Zones concernees :

- Plusieurs `.gitkeep` restent dans des dossiers maintenant non vides, par exemple `frontend/src/domains/admin/components/.gitkeep`, `event/components/.gitkeep`, `organization/components/.gitkeep`, `user/components/.gitkeep`.

Probleme : ce n'est pas bloquant, mais cela ajoute du bruit.

Correction proposee : supprimer les `.gitkeep` des dossiers qui contiennent deja des fichiers.

Peut attendre.

#### Styles globaux typographiques a harmoniser

Zones concernees :

- `frontend/src/shared/styles/_base.scss:4`
- `frontend/src/shared/styles/_base.scss:30`
- `frontend/src/shared/styles/_base.scss:42`
- `frontend/src/shared/styles/_tokens.scss:82`

Probleme : `#root` impose une largeur fixe avec bordures, `text-align: center` global, et les titres utilisent du letter-spacing negatif. Les pages corrigent souvent localement, mais cela peut creer des incoherences.

Correction proposee : faire de `main`/layouts la contrainte de largeur, garder `#root` neutre, et harmoniser la typographie.

Peut attendre.

## Elements a traiter avant integration backend

1. Decouper `dataStore` en services/repositories mock remplaçables par HTTP.
2. Stabiliser les contrats de types et payloads backend : account, user, organization, membership, event, report, notification.
3. Centraliser les validations event/organization avec schemas partages.
4. Brancher les permissions moderateur ou supprimer ce mock si non retenu.
5. Clarifier les parcours `user organisateur` vs `compte organization`.
6. Remplacer les mutations directes du store par des fonctions de service qui simulent deja les futurs endpoints.
7. Definir une strategie d'erreurs API et de loading par domaine.
8. Revoir les integrations meteo/email : client direct, proxy backend ou service serveur.

## Elements pouvant attendre

1. Nettoyage des `.gitkeep` et composants inutilises.
2. Harmonisation fine des textes et accents.
3. Deplacement progressif des styles metier hors de `shared`.
4. Page 404 dediee.
5. Refactor complet des dashboards en sous-composants, si le backend arrive rapidement. Au minimum, extraire les services avant.

## Conclusion

Le frontend est solide pour un prototype mocke et assez avance fonctionnellement. Le principal risque n'est pas l'absence de fonctionnalites, mais la concentration des responsabilites : store global, gros composants, validations dispersees et droits partiellement modelises. En traitant ces points avant le backend, l'integration API sera beaucoup plus simple et moins risquee.
