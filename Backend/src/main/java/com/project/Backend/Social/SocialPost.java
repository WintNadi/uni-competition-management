package com.project.Backend.Social;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Document(collection = "social_posts")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class SocialPost {

    @Id
    private String postId;
    private String sourceType;
    private String competitionId;
    private String competitionTitle;
    private String submissionId;
    private String externalParticipationId;
    private String winnerLabel;
    private String rankLabel;
    private String content;

    @Builder.Default
    private List<String> relatedStudentIds = new ArrayList<>();
    private String teamId;
    private String teamName;

    @Builder.Default
    private List<String> likedUserIds = new ArrayList<>();
    @Builder.Default
    private List<SocialComment> comments = new ArrayList<>();

    @Builder.Default
    private List<SocialLike> likes = new ArrayList<>();
    @Builder.Default
    private Integer likesCount = 0;
    @Builder.Default
    private Integer commentsCount = 0;

    @Builder.Default
    private boolean systemGenerated = true;
    private LocalDateTime createdAt;

    @Builder.Default
    private PostStatus status = PostStatus.PUBLISHED; // Default to PUBLISHED for posts

    public enum PostStatus {
        PUBLISHED,
        HIDDEN
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    @Builder
    public static class SocialLike {
        private String userId;
        private LocalDateTime createdAt;
    }

    public enum CommentStatus {
        VISIBLE,
        HIDDEN
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    @Builder
    public static class SocialComment {
        private String commentId;
        private String authorId;
        private String authorName;
        private String text;
        private LocalDateTime createdAt;

        // Default comment status to VISIBLE
        @Builder.Default
        private CommentStatus status = CommentStatus.VISIBLE;
    }
}