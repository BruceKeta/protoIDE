import { inject, injectable } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry, MessageService } from '@theia/core/lib/common';
import { CommonMenus, open, OpenerService } from '@theia/core/lib/browser';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileDialogService } from '@theia/filesystem/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { PROTO_APP_EXTENSION, createEmptyApplication, serializeApplication } from '../common/proto-model';

export namespace ProtoIdeCommands {
    const CATEGORY = 'ProtoIDE';
    export const NEW_APPLICATION: Command = { id: 'proto-ide.newApplication', category: CATEGORY, label: 'Nouvelle application…' };
    export const OPEN_APPLICATION: Command = { id: 'proto-ide.openApplication', category: CATEGORY, label: 'Ouvrir une application…' };
}

const FILTERS = { 'Application ProtoIDE': [PROTO_APP_EXTENSION.slice(1)] };

@injectable()
export class ProtoIdeContribution implements CommandContribution, MenuContribution {

    @inject(FileService) protected readonly fileService: FileService;
    @inject(FileDialogService) protected readonly fileDialogService: FileDialogService;
    @inject(WorkspaceService) protected readonly workspaceService: WorkspaceService;
    @inject(OpenerService) protected readonly openerService: OpenerService;
    @inject(MessageService) protected readonly messageService: MessageService;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(ProtoIdeCommands.NEW_APPLICATION, { execute: () => this.newApplication() });
        registry.registerCommand(ProtoIdeCommands.OPEN_APPLICATION, { execute: () => this.openApplication() });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.FILE_NEW_TEXT, {
            commandId: ProtoIdeCommands.NEW_APPLICATION.id, label: 'Nouvelle application ProtoIDE…', order: 'a0'
        });
        menus.registerMenuAction(CommonMenus.FILE_OPEN, {
            commandId: ProtoIdeCommands.OPEN_APPLICATION.id, label: 'Ouvrir une application ProtoIDE…', order: 'a0'
        });
    }

    protected async newApplication(): Promise<void> {
        const [root] = await this.workspaceService.roots;
        const uri = await this.fileDialogService.showSaveDialog({
            title: 'Nouvelle application ProtoIDE',
            saveLabel: 'Créer',
            inputValue: `MonApplication${PROTO_APP_EXTENSION}`,
            filters: FILTERS
        }, root);
        if (!uri) {
            return;
        }
        const target = uri.path.ext === PROTO_APP_EXTENSION ? uri : uri.parent.resolve(uri.path.base + PROTO_APP_EXTENSION);
        const app = createEmptyApplication(target.path.name);
        try {
            await this.fileService.write(target, serializeApplication(app));
        } catch (e) {
            this.messageService.error(`Création impossible : ${e instanceof Error ? e.message : e}`);
            return;
        }
        await open(this.openerService, target);
    }

    protected async openApplication(): Promise<void> {
        const [root] = await this.workspaceService.roots;
        const uri = await this.fileDialogService.showOpenDialog({
            title: 'Ouvrir une application ProtoIDE',
            openLabel: 'Ouvrir',
            canSelectFiles: true,
            canSelectFolders: false,
            filters: FILTERS
        }, root);
        if (uri) {
            await open(this.openerService, uri);
        }
    }
}
