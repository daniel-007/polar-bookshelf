import {ipcRenderer} from 'electron';
import {DialogWindowOptions} from './DialogWindow';
import {IPCMessage} from '../../ipc/handler/IPCMessage';
import {DialogWindowReference} from './DialogWindowReference';
import {IPCRendererPromises} from '../../electron/framework/IPCRenderPromises';
import {IPCClient} from '../../ipc/handler/IPCClient';

export class DialogWindowClient {

    private dialogWindowReference: DialogWindowReference;

    constructor(dialogWindowReference: DialogWindowReference) {
        this.dialogWindowReference = dialogWindowReference;
    }

    show(): void {

    }

    hide(): void {

        let ipcClient = new IPCClient()

    }

    /**
     * Send a message to the ipcRenderer in the remote window.
     */
    send(channel: string, message: any) {
        ipcRenderer.sendTo(this.dialogWindowReference.id, channel, message);
    }

    /**
     * Create a new DialogWindow as a client. We have a lightweight message to
     * the remote window to show/hide and work with it indirectly.
     *
     */
    static async create(options: DialogWindowOptions): Promise<DialogWindowClient> {

        let createRequest = new IPCMessage<DialogWindowOptions>('create', options);

        let channel = createRequest.computeResponseChannel();

        let createdPromise = await IPCRendererPromises.once(channel);

        ipcRenderer.send('dialog-window', createRequest);

        let {message} = await createdPromise;

        let createdWindowMessage = IPCMessage.create<DialogWindowReference>(message);

        return new DialogWindowClient(createdWindowMessage.value);

    }

}

