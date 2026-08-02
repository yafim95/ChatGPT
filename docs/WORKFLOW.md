# ProjectMind user workflow

ProjectMind works with an existing project folder. It does not copy, rename, reorganize, or delete source documents. The local database stores extracted text, search passages, project records, chats, reviews, and Comment Reply Sheets (CRS).

## First-time project setup

1. Create or open the project from **Projects**.
2. Open **Project controls** and choose the existing project folder.
3. Confirm the project disciplines, document hierarchy/precedence, decision-code labels, excluded paths, default review duration, and CRS behavior.
4. Open **Project files** and select **Sync index**. Supported documents become searchable; unsupported formats remain visible in the folder browser.
5. Open **Project memory** and mark the controlled baseline: Contract, Employer Requirements, specifications, approved IFC drawings, and authority requirements.
6. Add any durable project-specific AI rules, such as document precedence, terminology, or a prohibition on inferring authority approval.

## Discuss a file with AI

1. In **Project files**, select the file being discussed and choose **Discuss with AI**.
2. The file appears in the AI workspace's controlled-context rail. Add other review files only when they are relevant.
3. Keep **Include project memory** enabled when the question should be checked against contracts or other baseline documents.
4. Choose the answer mode:
   - **Evidence only** returns no project answer when matching indexed evidence is unavailable.
   - **Project + professional context** permits a clearly qualified general explanation when project evidence is incomplete.
   - **General** does not retrieve project documents.
5. Check the source chips below the answer. Each identifies its file and retrieval tier. Chats are saved locally and appear under the related file.

## Review a submitted document

1. Select the submitted file in **Project files** and choose **Start review**.
2. Set the review type, discipline, submittal/reference number, target date, and instructions.
3. Choose an AI-assisted first draft or a manual review. AI review prioritizes the submitted file, then permanent memory, then project-wide evidence.
4. Create the attached CRS and record one clear, actionable consultant comment per row.
5. Record the contractor reply and the consultant's final response. Close a CRS row only when its response is resolved for the current review stage.
6. Assign the consultant decision and close the review. When a changed file is indexed at the same path, ProjectMind creates a new revision and reopens the document for assessment while preserving the earlier review and CRS relationships.

Default decision codes are:

| Code | Meaning |
|---|---|
| 1 | Approved |
| 2 | Revise and resubmit — work may proceed |
| 3 | Revise and resubmit — work may not proceed |

The labels can be changed in **Project controls** to match the approved project document-control procedure.

## How project memory and RAG work

ProjectMind does not repeatedly upload the complete project library. Successfully extracted documents are split into overlapping local passages. For each project chat or AI review, context is assembled in three tiers:

1. relevant passages from explicitly selected review files;
2. relevant passages from documents marked as permanent project memory;
3. relevant passages from the rest of the current project index.

Duplicate passages are removed and the combined context is limited by the application settings. This keeps the request smaller and preserves source traceability. Source files, extracted text, the index, chats, reviews, and CRS records remain local; only the prompt and retrieved passages are sent when external AI is enabled and the user starts a request.

## Settings map

| Location | Controls |
|---|---|
| General | Theme, glass/solid visual style, interface density, motion, startup page, and compact navigation |
| AI Provider | External-AI permission, provider/base URL/model, protected API key, reasoning effort, timeout, and output budget |
| Retrieval | Project-wide result count, passage size/overlap, selected-file and memory limits, context budget, history size, automatic memory, and superseded search |
| Documents | Default project root, hidden-file visibility in the browser, and maximum indexing file size |
| Privacy | Saved chat history and external-data behavior |
| Backups | Automatic interval, retention, manual backup, and storage location |
| Advanced | Diagnostic logging, diagnostic folder, data folder, and safe renderer recovery |
| Project controls | Folder, recursion, exclusions, disciplines, hierarchy/precedence, decision codes, CRS defaults, due dates, and durable project AI instructions |

## Important limits

- Image-only PDFs need OCR and are visibly marked as not searchable.
- Drawing formats such as DWG remain visible but are not text-indexed in this release.
- CSV is the current CRS export format; formatted XLSX/DOCX templates remain roadmap work.
- AI output assists qualified professionals and does not replace engineering judgment, contractual review, or authority approval.
