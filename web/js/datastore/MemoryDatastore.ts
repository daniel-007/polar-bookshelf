/**
 * Datastore just in memory with no on disk persistence.
 */
import {
    Datastore, InitResult, FileRef, FileMeta, DocMetaSnapshotEvent,
    SnapshotResult, DocMetaSnapshotEventListener, DocMetaSnapshotBatch,
    AbstractDatastore, ErrorListener } from './Datastore';
import {Preconditions, isPresent} from '../Preconditions';
import {DocMetaFileRef, DocMetaRef} from './DocMetaRef';
import {FilePaths} from '../util/FilePaths';
import {Directories} from './Directories';
import {Logger} from '../logger/Logger';
import {DeleteResult} from './Datastore';
import {FileDeleted, FileHandle, Files} from '../util/Files';
import {Backend} from './Backend';
import {DatastoreFile} from './DatastoreFile';
import {Optional} from '../util/ts/Optional';
import {DocInfo} from '../metadata/DocInfo';
import {DatastoreMutation, DefaultDatastoreMutation} from './DatastoreMutation';
import {Datastores} from './Datastores';
import {DocMetaSnapshotEventListeners} from './DocMetaSnapshotEventListeners';
import {NULL_FUNCTION} from '../util/Functions';
import {DiskInitResult} from './DiskDatastore';

const log = Logger.create();

export class MemoryDatastore extends AbstractDatastore implements Datastore {

    public readonly id = 'memory';

    public readonly stashDir: string;

    public readonly filesDir: string;

    public readonly dataDir: string;

    public readonly logsDir: string;

    public readonly directories: Directories;

    protected readonly docMetas: {[fingerprint: string]: string} = {};

    protected readonly files: {[key: string]: FileData} = {};

    constructor() {
        super();

        this.directories = new Directories();

        // these dir values are used in the UI and other places so we need to
        // actually have values for them.
        this.dataDir = Directories.getDataDir().path;
        this.stashDir = FilePaths.create(this.dataDir, "stash");
        this.filesDir = FilePaths.create(this.dataDir, "files");

        this.logsDir = FilePaths.create(this.dataDir, "logs");

        this.docMetas = {};

    }

    // noinspection TsLint
    public async init(errorListener: ErrorListener = NULL_FUNCTION): Promise<DiskInitResult> {
        return await this.directories.init();
    }

    public async stop() {
        // noop
    }

    public async contains(fingerprint: string): Promise<boolean> {
        return fingerprint in this.docMetas;
    }

    public async delete(docMetaFileRef: DocMetaFileRef): Promise<Readonly<DeleteResult>> {

        const result: any = {
            docMetaFile: {
                path: `/${docMetaFileRef.fingerprint}.json`,
                deleted: false
            },
            dataFile: {
                path: '/' + Optional.of(docMetaFileRef.docFile)
                                .map(current => current.name)
                                .getOrUndefined(),
                deleted: false
            }
        };

        if (await this.contains(docMetaFileRef.fingerprint)) {
            result.docMetaFile.deleted = true;
            result.dataFile.deleted = true;
        }

        return result;

    }

    public async writeFile(backend: Backend,
                           ref: FileRef,
                           data: FileHandle | Buffer | string,
                           meta: FileMeta = {}): Promise<DatastoreFile> {

        const key = this.toFileRefKey(backend, ref);

        let buff: Buffer | undefined;

        if (typeof data === 'string') {
            buff = Buffer.from(data);
        } else if (data instanceof Buffer) {
            buff = data;
        } else {
            buff = await Files.readFileAsync(data.path);
        }

        this.files[key] = {buffer: buff!, meta};

        return {backend, ref, url: 'FIXME:none', meta};

    }

    public async getFile(backend: Backend, ref: FileRef): Promise<Optional<DatastoreFile>> {

        const key = this.toFileRefKey(backend, ref);

        if (!key) {
            return Optional.empty();
        }

        const fileData = this.files[key];

        return Optional.of({backend, ref, url: 'FIXME:none', meta: fileData.meta});

    }

    public async containsFile(backend: Backend, ref: FileRef): Promise<boolean> {
        const key = this.toFileRefKey(backend, ref);
        return isPresent(this.files[key]);
    }

    public async deleteFile(backend: Backend, ref: FileRef): Promise<void> {
        const key = this.toFileRefKey(backend, ref);
        delete this.files[key];
    }

    /**
     */
    public async getDocMeta(fingerprint: string): Promise<string | null> {

        const nrDocs = Object.keys(this.docMetas).length;

        log.info(`Fetching document from datastore with fingerprint ${fingerprint} of ${nrDocs} docs.`);

        return this.docMetas[fingerprint];
    }

    /**
     * Write the datastore to disk.
     */
    public async write(fingerprint: string,
                       data: string,
                       docInfo: DocInfo,
                       datastoreMutation: DatastoreMutation<boolean> = new DefaultDatastoreMutation()): Promise<void> {

        Preconditions.assertTypeOf(data, "string", "data");

        this.docMetas[fingerprint] = data;

        datastoreMutation.written.resolve(true);
        datastoreMutation.committed.resolve(true);

    }

    public async getDocMetaFiles(): Promise<DocMetaRef[]> {

        return Object.keys(this.docMetas)
            .map(fingerprint => <DocMetaRef> {fingerprint});

    }

    public async snapshot(listener: DocMetaSnapshotEventListener): Promise<SnapshotResult> {

        return Datastores.createCommittedSnapshot(this, listener);

    }

    public addDocMetaSnapshotEventListener(docMetaSnapshotEventListener: DocMetaSnapshotEventListener): void {
        // noop now
    }

    private toFileRefKey(backend: Backend, fileRef: FileRef) {
        return `${backend}:${fileRef.name}`;
    }

}

interface FileData {
    buffer: Buffer;
    meta: FileMeta;
}
