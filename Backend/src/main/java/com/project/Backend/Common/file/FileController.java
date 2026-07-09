package com.project.Backend.Common.file;

import com.mongodb.client.gridfs.GridFSBucket;
import com.mongodb.client.gridfs.model.GridFSFile;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Objects;

@RestController
@RequestMapping("/api/files")
@CrossOrigin(origins = "*", maxAge = 3600)
public class FileController {

    @Autowired
    private GridFsTemplate gridFsTemplate;

    @Autowired
    private GridFSBucket gridFSBucket;

    @GetMapping("/{id}")
    public ResponseEntity<?> getFile(@PathVariable String id) {
        try {
            Object queryId = ObjectId.isValid(id) ? new ObjectId(id) : id;
            GridFSFile gridFSFile = gridFsTemplate.findOne(new Query(Criteria.where("_id").is(queryId)));
            if (gridFSFile == null) {
                // Legacy compatibility: some records store filename instead of _id.
                gridFSFile = gridFsTemplate.findOne(new Query(Criteria.where("filename").is(id)));
            }

            if (gridFSFile == null) {
                return ResponseEntity.notFound().build();
            }

            GridFsResource resource = new GridFsResource(gridFSFile, gridFSBucket.openDownloadStream(gridFSFile.getObjectId()));
            String contentType = null;
            if (gridFSFile.getMetadata() != null) {
                Object legacy = gridFSFile.getMetadata().get("_contentType");
                Object custom = gridFSFile.getMetadata().get("contentType");
                Object mimeType = gridFSFile.getMetadata().get("mimeType");
                contentType = Objects.toString(legacy, null);
                if (contentType == null || contentType.isBlank()) {
                    contentType = Objects.toString(custom, null);
                }
                if (contentType == null || contentType.isBlank()) {
                    contentType = Objects.toString(mimeType, null);
                }
            }
            if (contentType == null || contentType.isBlank()) {
                contentType = resource.getContentType();
            }
            if (contentType == null || contentType.isBlank()) {
                contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + gridFSFile.getFilename() + "\"")
                    .body(new InputStreamResource(resource.getInputStream()));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/{id}/{fileName:.+}")
    public ResponseEntity<?> getFileWithName(@PathVariable String id, @PathVariable String fileName) {
        return getFile(id);
    }
}
