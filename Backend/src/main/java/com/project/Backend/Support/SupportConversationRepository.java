package com.project.Backend.Support;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SupportConversationRepository extends MongoRepository<SupportConversation, String> {

    List<SupportConversation> findByStudentIdOrderByLastMessageAtDesc(String studentId);

    List<SupportConversation> findByStatusOrderByLastMessageAtDesc(String status);
}

