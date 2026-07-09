package com.project.Backend.Milestone;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

public interface MilestoneRepository extends MongoRepository<Milestone, String> {
    List<Milestone> findByStudentId(String studentId);

    boolean existsByStudentIdAndTitle(String studentId, String title);
}
