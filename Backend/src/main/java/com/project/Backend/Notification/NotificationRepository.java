package com.project.Backend.Notification;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface NotificationRepository extends MongoRepository<Notification, String> {
    List<Notification> findByRecipientIdOrderByCreatedAtDesc(String recipientId);

    List<Notification> findByRecipientIdAndIsReadFalse(String recipientId);

    boolean existsByRecipientIdAndTypeAndRelatedEntityId(
            String recipientId,
            NotificationType type,
            String relatedEntityId);
}
