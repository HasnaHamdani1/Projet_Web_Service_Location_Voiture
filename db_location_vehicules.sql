-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : mer. 28 oct. 2026 à 23:53
-- Version du serveur : 10.4.32-MariaDB
-- Version de PHP : 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `db_location_vehicules`
--

-- --------------------------------------------------------

--
-- Structure de la table `administrateur`
--

CREATE TABLE `administrateur` (
  `id` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `client`
--

CREATE TABLE `client` (
  `id` bigint(20) NOT NULL,
  `adresse` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `contrat`
--

CREATE TABLE `contrat` (
  `id` bigint(20) NOT NULL,
  `numero_contrat` varchar(100) NOT NULL,
  `date_generation` date NOT NULL,
  `statut` enum('EN_ATTENTE','VALIDE','CLOTURE') DEFAULT 'EN_ATTENTE',
  `periode_prise` date NOT NULL,
  `periode_fin` date NOT NULL,
  `montant_total` double NOT NULL,
  `reservation_id` bigint(20) DEFAULT NULL,
  `client_id` bigint(20) NOT NULL,
  `vehicule_id` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `reservation`
--

CREATE TABLE `reservation` (
  `id` bigint(20) NOT NULL,
  `date_reservation` datetime DEFAULT current_timestamp(),
  `date_debut` date NOT NULL,
  `date_fin` date NOT NULL,
  `statut` enum('EN_ATTENTE','CONFIRMEE','ANNULEE','PAYEE') DEFAULT 'EN_ATTENTE',
  `montant_estime` double NOT NULL,
  `client_id` bigint(20) NOT NULL,
  `vehicule_id` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `retour`
--

CREATE TABLE `retour` (
  `id` bigint(20) NOT NULL,
  `date_retour` date NOT NULL,
  `etat_vehicule` enum('BON','LEGER_DOMMAGE','DOMMAGE_IMPORTANT') NOT NULL,
  `en_retard` tinyint(1) DEFAULT 0,
  `duree_retard_jours` int(11) DEFAULT 0,
  `montant_retard` double DEFAULT 0,
  `dommage` text DEFAULT NULL,
  `montant_dommage` double DEFAULT 0,
  `contrat_id` bigint(20) NOT NULL,
  `vehicule_id` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `utilisateur`
--

CREATE TABLE `utilisateur` (
  `id` bigint(20) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `mot_de_passe` varchar(255) NOT NULL,
  `telephone` varchar(30) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `vehicule`
--

CREATE TABLE `vehicule` (
  `id` bigint(20) NOT NULL,
  `immatriculation` varchar(50) NOT NULL,
  `marque` varchar(100) NOT NULL,
  `modele` varchar(100) NOT NULL,
  `annee` int(11) NOT NULL,
  `prix_par_jour` double NOT NULL,
  `statut` enum('DISPONIBLE','RESERVE','LOUE','MAINTENANCE') DEFAULT 'DISPONIBLE'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `administrateur`
--
ALTER TABLE `administrateur`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `client`
--
ALTER TABLE `client`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `contrat`
--
ALTER TABLE `contrat`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero_contrat` (`numero_contrat`),
  ADD UNIQUE KEY `reservation_id` (`reservation_id`),
  ADD KEY `fk_contrat_client` (`client_id`),
  ADD KEY `fk_contrat_vehicule` (`vehicule_id`);

--
-- Index pour la table `reservation`
--
ALTER TABLE `reservation`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_reservation_client` (`client_id`),
  ADD KEY `fk_reservation_vehicule` (`vehicule_id`);

--
-- Index pour la table `retour`
--
ALTER TABLE `retour`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `contrat_id` (`contrat_id`),
  ADD KEY `fk_retour_vehicule` (`vehicule_id`);

--
-- Index pour la table `utilisateur`
--
ALTER TABLE `utilisateur`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Index pour la table `vehicule`
--
ALTER TABLE `vehicule`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `immatriculation` (`immatriculation`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `contrat`
--
ALTER TABLE `contrat`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `reservation`
--
ALTER TABLE `reservation`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `retour`
--
ALTER TABLE `retour`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `utilisateur`
--
ALTER TABLE `utilisateur`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `vehicule`
--
ALTER TABLE `vehicule`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `administrateur`
--
ALTER TABLE `administrateur`
  ADD CONSTRAINT `fk_admin_utilisateur` FOREIGN KEY (`id`) REFERENCES `utilisateur` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `client`
--
ALTER TABLE `client`
  ADD CONSTRAINT `fk_client_utilisateur` FOREIGN KEY (`id`) REFERENCES `utilisateur` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `contrat`
--
ALTER TABLE `contrat`
  ADD CONSTRAINT `fk_contrat_client` FOREIGN KEY (`client_id`) REFERENCES `client` (`id`),
  ADD CONSTRAINT `fk_contrat_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservation` (`id`),
  ADD CONSTRAINT `fk_contrat_vehicule` FOREIGN KEY (`vehicule_id`) REFERENCES `vehicule` (`id`);

--
-- Contraintes pour la table `reservation`
--
ALTER TABLE `reservation`
  ADD CONSTRAINT `fk_reservation_client` FOREIGN KEY (`client_id`) REFERENCES `client` (`id`),
  ADD CONSTRAINT `fk_reservation_vehicule` FOREIGN KEY (`vehicule_id`) REFERENCES `vehicule` (`id`);

--
-- Contraintes pour la table `retour`
--
ALTER TABLE `retour`
  ADD CONSTRAINT `fk_retour_contrat` FOREIGN KEY (`contrat_id`) REFERENCES `contrat` (`id`),
  ADD CONSTRAINT `fk_retour_vehicule` FOREIGN KEY (`vehicule_id`) REFERENCES `vehicule` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
