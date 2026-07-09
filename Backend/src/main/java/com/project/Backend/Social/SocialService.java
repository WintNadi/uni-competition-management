package com.project.Backend.Social;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.project.Backend.User.User;
import com.project.Backend.User.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SocialService {

    private final SocialPostRepository socialPostRepository;
    private final UserRepository userRepository;

    public List<SocialPostView> listPosts(String currentUserId) {
        return socialPostRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .filter(post -> post.getStatus() == SocialPost.PostStatus.PUBLISHED)
                .filter(post -> post.getRankLabel() == null
                        || !post.getRankLabel().equalsIgnoreCase("Participant"))
                .map(post -> mapToView(post, currentUserId, false))
                .toList();
    }

    public List<SocialPostView> adminListPosts(String currentUserId) {
        return socialPostRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .filter(post -> post.getRankLabel() == null
                        || !post.getRankLabel().equalsIgnoreCase("Participant"))
                .map(post -> mapToView(post, currentUserId, true))
                .toList();
    }

    public SocialPostView likePost(String postId, String studentId) {
        SocialPost post = socialPostRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));
        validateInteractionAllowed(post, studentId);

        // Prefer new likes array, but keep backward compatibility with old
        // likedUserIds
        List<SocialPost.SocialLike> likes = post.getLikes() == null
                ? new java.util.ArrayList<>()
                : new java.util.ArrayList<>(post.getLikes());

        boolean alreadyLiked = likes.stream().anyMatch(l -> studentId.equals(l.getUserId()));

        if (alreadyLiked) {
            likes.removeIf(l -> studentId.equals(l.getUserId()));
        } else {
            likes.add(SocialPost.SocialLike.builder()
                    .userId(studentId)
                    .createdAt(LocalDateTime.now())
                    .build());
        }

        post.setLikes(likes);

        // keep likedUserIds in sync (so old UI logic / old docs still safe)
        List<String> likedUserIds = likes.stream()
                .map(SocialPost.SocialLike::getUserId)
                .distinct()
                .toList();
        post.setLikedUserIds(new java.util.ArrayList<>(likedUserIds));

        post.setLikesCount(likedUserIds.size());

        SocialPost saved = socialPostRepository.save(post);
        return mapToView(saved, studentId, false);
    }

    public SocialPostView commentPost(String postId, String studentId, String text) {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Comment text is required");
        }
        SocialPost post = socialPostRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));
        validateInteractionAllowed(post, studentId);

        List<SocialPost.SocialComment> comments = post.getComments() == null
                ? new java.util.ArrayList<>()
                : new java.util.ArrayList<>(post.getComments());

        boolean alreadyCommented = comments.stream()
                .anyMatch(comment -> studentId.equals(comment.getAuthorId()));
        if (alreadyCommented) {
            throw new IllegalStateException("You can only comment once on the same post");
        }

        String authorName = resolveDisplayName(studentId);
        comments.add(SocialPost.SocialComment.builder()
                .commentId(UUID.randomUUID().toString())
                .authorId(studentId)
                .authorName(authorName)
                .text(text.trim())
                .createdAt(LocalDateTime.now())
                .build());

        post.setComments(comments);
        post.setCommentsCount(comments.size());
        SocialPost saved = socialPostRepository.save(post);
        return mapToView(saved, studentId, false);
    }

    public SocialPostView editComment(String postId, String commentId, String studentId, String text) {
        if (commentId == null || commentId.isBlank()) {
            throw new IllegalArgumentException("commentId is required");
        }
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("Comment text is required");
        }
        SocialPost post = socialPostRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        List<SocialPost.SocialComment> comments = post.getComments() == null
                ? new java.util.ArrayList<>()
                : new java.util.ArrayList<>(post.getComments());

        SocialPost.SocialComment target = comments.stream()
                .filter(comment -> commentId.equals(comment.getCommentId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Comment not found"));

        if (!studentId.equals(target.getAuthorId())) {
            throw new IllegalStateException("Only the author can edit this comment");
        }

        target.setText(text.trim());
        post.setComments(comments);
        post.setCommentsCount(comments.size());
        SocialPost saved = socialPostRepository.save(post);
        return mapToView(saved, studentId, false);
    }

    public SocialPostView deleteComment(String postId, String commentId, String studentId) {
        if (commentId == null || commentId.isBlank()) {
            throw new IllegalArgumentException("commentId is required");
        }
        SocialPost post = socialPostRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        List<SocialPost.SocialComment> comments = post.getComments() == null
                ? new java.util.ArrayList<>()
                : new java.util.ArrayList<>(post.getComments());

        SocialPost.SocialComment target = comments.stream()
                .filter(comment -> commentId.equals(comment.getCommentId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Comment not found"));

        if (!studentId.equals(target.getAuthorId())) {
            throw new IllegalStateException("Only the author can delete this comment");
        }

        comments.removeIf(comment -> commentId.equals(comment.getCommentId()));
        post.setComments(comments);
        post.setCommentsCount(comments.size());
        SocialPost saved = socialPostRepository.save(post);
        return mapToView(saved, studentId, false);
    }

    private void validateInteractionAllowed(SocialPost post, String studentId) {
        if (studentId == null || studentId.isBlank()) {
            throw new IllegalArgumentException("User is not authenticated");
        }
        List<String> relatedIds = post.getRelatedStudentIds() == null ? List.of() : post.getRelatedStudentIds();
        if (relatedIds.stream().anyMatch(studentId::equals)) {
            throw new IllegalStateException("You cannot interact with your own achievement post");
        }
    }

    private SocialPostView mapToView(SocialPost post, String currentUserId, boolean isAdmin) {
        List<String> relatedStudentIds = post.getRelatedStudentIds() == null ? List.of() : post.getRelatedStudentIds();
        List<SocialCommentView> commentViews = (post.getComments() == null ? List.<SocialPost.SocialComment>of()
                : post.getComments())
                .stream()
                .filter(c -> isAdmin || c.getStatus() == SocialPost.CommentStatus.VISIBLE)
                .map(comment -> new SocialCommentView(
                        comment.getCommentId(),
                        comment.getAuthorId(),
                        comment.getAuthorName(),
                        comment.getText(),
                        comment.getCreatedAt(),
                        comment.getStatus() == SocialPost.CommentStatus.HIDDEN))
                .toList();

        boolean likedByCurrentUser = false;

        if (currentUserId != null) {
            // new storage first
            if (post.getLikes() != null
                    && post.getLikes().stream().anyMatch(l -> currentUserId.equals(l.getUserId()))) {
                likedByCurrentUser = true;
            }
            // fallback to old storage for old documents
            else if (post.getLikedUserIds() != null
                    && post.getLikedUserIds().stream().anyMatch(currentUserId::equals)) {
                likedByCurrentUser = true;
            }
        }
        boolean canInteract = currentUserId != null
                && relatedStudentIds.stream().noneMatch(currentUserId::equals);

        SocialAchievementView achievement = new SocialAchievementView(
                buildAchievementTitle(post),
                post.getCompetitionTitle(),
                safeRankLabel(post.getRankLabel()),
                post.getWinnerLabel());

        return new SocialPostView(
                post.getPostId(),
                "AcademiX System",
                avatarForRank(post.getRankLabel()),
                post.getContent(),
                achievement,
                post.getLikesCount() == null ? 0 : post.getLikesCount(),
                commentViews,
                post.getCreatedAt(),
                likedByCurrentUser,
                canInteract,
                relatedStudentIds,
                post.getStatus() == null ? "published" : post.getStatus().name().toLowerCase());
    }

    private String resolveDisplayName(String userId) {
        if (userId == null || userId.isBlank()) {
            return "Student";
        }
        return userRepository.findById(userId)
                .map(this::resolveDisplayName)
                .orElse("Student");
    }

    private String resolveDisplayName(User user) {
        if (user == null) {
            return "Student";
        }
        if (user.getFullName() != null && !user.getFullName().isBlank()) {
            return user.getFullName().trim();
        }
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return user.getUsername().trim();
        }
        return "Student";
    }

    private String buildAchievementTitle(SocialPost post) {
        String rank = safeRankLabel(post.getRankLabel());
        String competition = post.getCompetitionTitle() == null ? "Competition" : post.getCompetitionTitle();
        if ("Participant".equalsIgnoreCase(rank)) {
            return "Participation";
        }
        if ("Gold".equalsIgnoreCase(rank)) {
            return "1st Place - " + competition;
        }
        if ("Silver".equalsIgnoreCase(rank)) {
            return "2nd Place - " + competition;
        }
        return "3rd Place - " + competition;
    }

    private String safeRankLabel(String rankLabel) {
        String rank = rankLabel == null ? "" : rankLabel.trim();
        if (rank.isEmpty()) {
            return "Participant";
        }
        String normalized = rank.toLowerCase(Locale.ROOT);
        if (normalized.contains("gold")
                || normalized.contains("winner")
                || normalized.contains("top 1")
                || normalized.contains("1st")
                || normalized.contains("first"))
            return "Gold";
        if (normalized.contains("silver")
                || normalized.contains("top 2")
                || normalized.contains("2nd")
                || normalized.contains("second"))
            return "Silver";
        if (normalized.contains("bronze")
                || normalized.contains("top 3")
                || normalized.contains("3rd")
                || normalized.contains("third"))
            return "Bronze";
        if (normalized.contains("participant"))
            return "Participant";
        return rank;
    }

    private String avatarForRank(String rankLabel) {
        String rank = safeRankLabel(rankLabel);
        return switch (rank) {
            case "Gold" -> "\uD83C\uDFC6";
            case "Silver" -> "\uD83E\uDD48";
            case "Bronze" -> "\uD83E\uDD49";
            default -> "\uD83C\uDF96\uFE0F";
        };
    }

    public record SocialAchievementView(
            String title,
            String competition,
            String rank,
            String winner) {
    }

    public record SocialCommentView(
            String id,
            String authorId,
            String author,
            String text,
            LocalDateTime createdAt,
            boolean hidden) {
    }

    public record SocialPostView(
            String id,
            String author,
            String avatar,
            String content,
            SocialAchievementView achievement,
            int likes,
            List<SocialCommentView> comments,
            LocalDateTime createdAt,
            boolean userLiked,
            boolean canInteract,
            List<String> relatedStudentIds,
            String status) {
    } // ================= ADMIN MODERATION =================

    // Hide Post
    public void adminHidePost(String postId) {
        SocialPost post = socialPostRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        post.setStatus(SocialPost.PostStatus.HIDDEN);
        socialPostRepository.save(post);
    }

    // Restore Post
    public void adminRestorePost(String postId) {
        SocialPost post = socialPostRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        post.setStatus(SocialPost.PostStatus.PUBLISHED);
        socialPostRepository.save(post);
    }

    // Permanently delete Post
    public void adminDeletePost(String postId) {
        socialPostRepository.deleteById(postId);
    }

    // Hide Comment
    public void adminHideComment(String postId, String commentId) {
        SocialPost post = socialPostRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        List<SocialPost.SocialComment> comments = post.getComments() == null ? List.of() : post.getComments();
        for (SocialPost.SocialComment comment : comments) {
            if (comment.getCommentId().equals(commentId)) {
                comment.setStatus(SocialPost.CommentStatus.HIDDEN);
            }
        }

        socialPostRepository.save(post);
    }

    // Restore Comment
    public void adminRestoreComment(String postId, String commentId) {
        SocialPost post = socialPostRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        List<SocialPost.SocialComment> comments = post.getComments() == null ? List.of() : post.getComments();
        for (SocialPost.SocialComment comment : comments) {
            if (comment.getCommentId().equals(commentId)) {
                comment.setStatus(SocialPost.CommentStatus.VISIBLE);
            }
        }

        socialPostRepository.save(post);
    }

    // Permanently delete Comment
    public void adminDeleteComment(String postId, String commentId) {
        SocialPost post = socialPostRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));

        List<SocialPost.SocialComment> comments = post.getComments() == null
                ? new java.util.ArrayList<>()
                : new java.util.ArrayList<>(post.getComments());
        comments.removeIf(c -> c.getCommentId().equals(commentId));
        post.setComments(comments);
        post.setCommentsCount(comments.size());

        socialPostRepository.save(post);
    }
}
