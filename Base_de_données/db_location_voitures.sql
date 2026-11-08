-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : dim. 08 nov. 2026 à 12:31
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
-- Base de données : `db_location_voitures`
--
CREATE DATABASE IF NOT EXISTS db_location_voitures
    CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE db_location_voitures;

--
-- Structure de la table `administrateurs`
--

CREATE TABLE `administrateurs` (
  `id` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `clients`
--

CREATE TABLE `clients` (
  `id` bigint(20) NOT NULL,
  `adresse` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `contrats`
--

CREATE TABLE `contrats` (
  `id` bigint(20) NOT NULL,
  `numeroContrat` varchar(50) NOT NULL,
  `dateGeneration` date NOT NULL,
  `statut` enum('EN_ATTENTE','VALIDE','CLOTURE') NOT NULL DEFAULT 'EN_ATTENTE',
  `periodePrise` date NOT NULL,
  `periodeFin` date NOT NULL,
  `montantTotal` decimal(10,2) NOT NULL,
  `reservation_id` bigint(20) NOT NULL,
  `administrateur_id` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `reservations`
--

CREATE TABLE `reservations` (
  `id` bigint(20) NOT NULL,
  `dateReservation` date NOT NULL,
  `dateDebut` date NOT NULL,
  `dateFin` date NOT NULL,
  `statut` enum('EN_ATTENTE','CONFIRMEE','ANNULEE') NOT NULL DEFAULT 'EN_ATTENTE',
  `montantEstime` decimal(10,2) NOT NULL,
  `client_id` bigint(20) NOT NULL,
  `vehicule_id` bigint(20) NOT NULL,
  `administrateur_id` bigint(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `retours`
--

CREATE TABLE `retours` (
  `id` bigint(20) NOT NULL,
  `dateRetour` date NOT NULL,
  `etatVehicule` enum('BON','LEGER_DOMMAGE','DOMMAGE_IMPORTANT') NOT NULL,
  `enRetard` tinyint(1) NOT NULL DEFAULT 0,
  `dureeRetardJours` int(11) NOT NULL DEFAULT 0,
  `montantRetard` decimal(10,2) NOT NULL DEFAULT 0.00,
  `dommage` varchar(255) DEFAULT NULL,
  `montantDommage` decimal(10,2) NOT NULL DEFAULT 0.00,
  `contrat_id` bigint(20) NOT NULL,
  `administrateur_id` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `utilisateurs`
--

CREATE TABLE `utilisateurs` (
  `id` bigint(20) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `motDePasse` varchar(255) NOT NULL,
  `telephone` varchar(20) DEFAULT NULL,
  `role` enum('CLIENT','ADMINISTRATEUR') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `vehicules`
--

CREATE TABLE `vehicules` (
  `id` bigint(20) NOT NULL,
  `immatriculation` varchar(30) NOT NULL,
  `marque` varchar(100) NOT NULL,
  `modele` varchar(100) NOT NULL,
  `annee` int(11) NOT NULL,
  `prixParJour` decimal(10,2) NOT NULL,
  `statut` enum('DISPONIBLE','RESERVE','LOUE','MAINTENANCE') NOT NULL DEFAULT 'DISPONIBLE',
  `administrateur_id` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `administrateurs`
--
ALTER TABLE `administrateurs`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `clients`
--
ALTER TABLE `clients`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `contrats`
--
ALTER TABLE `contrats`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numeroContrat` (`numeroContrat`),
  ADD UNIQUE KEY `reservation_id` (`reservation_id`),
  ADD KEY `fk_contrat_admin` (`administrateur_id`);

--
-- Index pour la table `reservations`
--
ALTER TABLE `reservations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_reservation_client` (`client_id`),
  ADD KEY `fk_reservation_vehicule` (`vehicule_id`),
  ADD KEY `fk_reservation_admin` (`administrateur_id`);

--
-- Index pour la table `retours`
--
ALTER TABLE `retours`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `contrat_id` (`contrat_id`),
  ADD KEY `fk_retour_admin` (`administrateur_id`);

--
-- Index pour la table `utilisateurs`
--
ALTER TABLE `utilisateurs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Index pour la table `vehicules`
--
ALTER TABLE `vehicules`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `immatriculation` (`immatriculation`),
  ADD KEY `fk_vehicule_admin` (`administrateur_id`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `contrats`
--
ALTER TABLE `contrats`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `reservations`
--
ALTER TABLE `reservations`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `retours`
--
ALTER TABLE `retours`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `utilisateurs`
--
ALTER TABLE `utilisateurs`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `vehicules`
--
ALTER TABLE `vehicules`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `administrateurs`
--
ALTER TABLE `administrateurs`
  ADD CONSTRAINT `fk_admin_utilisateur` FOREIGN KEY (`id`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `clients`
--
ALTER TABLE `clients`
  ADD CONSTRAINT `fk_client_utilisateur` FOREIGN KEY (`id`) REFERENCES `utilisateurs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Contraintes pour la table `contrats`
--
ALTER TABLE `contrats`
  ADD CONSTRAINT `fk_contrat_admin` FOREIGN KEY (`administrateur_id`) REFERENCES `administrateurs` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_contrat_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `reservations`
--
ALTER TABLE `reservations`
  ADD CONSTRAINT `fk_reservation_admin` FOREIGN KEY (`administrateur_id`) REFERENCES `administrateurs` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_reservation_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_reservation_vehicule` FOREIGN KEY (`vehicule_id`) REFERENCES `vehicules` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `retours`
--
ALTER TABLE `retours`
  ADD CONSTRAINT `fk_retour_admin` FOREIGN KEY (`administrateur_id`) REFERENCES `administrateurs` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_retour_contrat` FOREIGN KEY (`contrat_id`) REFERENCES `contrats` (`id`) ON UPDATE CASCADE;

--
-- Contraintes pour la table `vehicules`
--
ALTER TABLE `vehicules`
  ADD CONSTRAINT `fk_vehicule_admin` FOREIGN KEY (`administrateur_id`) REFERENCES `administrateurs` (`id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
