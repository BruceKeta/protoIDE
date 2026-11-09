"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtoIdeContribution = exports.ProtoIdeCommands = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const common_1 = require("@theia/core/lib/common");
const browser_1 = require("@theia/core/lib/browser");
const file_service_1 = require("@theia/filesystem/lib/browser/file-service");
const browser_2 = require("@theia/filesystem/lib/browser");
const workspace_service_1 = require("@theia/workspace/lib/browser/workspace-service");
const proto_model_1 = require("../common/proto-model");
var ProtoIdeCommands;
(function (ProtoIdeCommands) {
    const CATEGORY = 'ProtoIDE';
    ProtoIdeCommands.NEW_APPLICATION = { id: 'proto-ide.newApplication', category: CATEGORY, label: 'Nouvelle application…' };
    ProtoIdeCommands.OPEN_APPLICATION = { id: 'proto-ide.openApplication', category: CATEGORY, label: 'Ouvrir une application…' };
})(ProtoIdeCommands || (exports.ProtoIdeCommands = ProtoIdeCommands = {}));
const FILTERS = { 'Application ProtoIDE': [proto_model_1.PROTO_APP_EXTENSION.slice(1)] };
let ProtoIdeContribution = class ProtoIdeContribution {
    registerCommands(registry) {
        registry.registerCommand(ProtoIdeCommands.NEW_APPLICATION, { execute: () => this.newApplication() });
        registry.registerCommand(ProtoIdeCommands.OPEN_APPLICATION, { execute: () => this.openApplication() });
    }
    registerMenus(menus) {
        menus.registerMenuAction(browser_1.CommonMenus.FILE_NEW_TEXT, {
            commandId: ProtoIdeCommands.NEW_APPLICATION.id, label: 'Nouvelle application ProtoIDE…', order: 'a0'
        });
        menus.registerMenuAction(browser_1.CommonMenus.FILE_OPEN, {
            commandId: ProtoIdeCommands.OPEN_APPLICATION.id, label: 'Ouvrir une application ProtoIDE…', order: 'a0'
        });
    }
    async newApplication() {
        const [root] = await this.workspaceService.roots;
        const uri = await this.fileDialogService.showSaveDialog({
            title: 'Nouvelle application ProtoIDE',
            saveLabel: 'Créer',
            inputValue: `MonApplication${proto_model_1.PROTO_APP_EXTENSION}`,
            filters: FILTERS
        }, root);
        if (!uri) {
            return;
        }
        const target = uri.path.ext === proto_model_1.PROTO_APP_EXTENSION ? uri : uri.parent.resolve(uri.path.base + proto_model_1.PROTO_APP_EXTENSION);
        const app = (0, proto_model_1.createEmptyApplication)(target.path.name);
        try {
            await this.fileService.write(target, (0, proto_model_1.serializeApplication)(app));
        }
        catch (e) {
            this.messageService.error(`Création impossible : ${e instanceof Error ? e.message : e}`);
            return;
        }
        await (0, browser_1.open)(this.openerService, target);
    }
    async openApplication() {
        const [root] = await this.workspaceService.roots;
        const uri = await this.fileDialogService.showOpenDialog({
            title: 'Ouvrir une application ProtoIDE',
            openLabel: 'Ouvrir',
            canSelectFiles: true,
            canSelectFolders: false,
            filters: FILTERS
        }, root);
        if (uri) {
            await (0, browser_1.open)(this.openerService, uri);
        }
    }
};
exports.ProtoIdeContribution = ProtoIdeContribution;
__decorate([
    (0, inversify_1.inject)(file_service_1.FileService),
    __metadata("design:type", file_service_1.FileService)
], ProtoIdeContribution.prototype, "fileService", void 0);
__decorate([
    (0, inversify_1.inject)(browser_2.FileDialogService),
    __metadata("design:type", Object)
], ProtoIdeContribution.prototype, "fileDialogService", void 0);
__decorate([
    (0, inversify_1.inject)(workspace_service_1.WorkspaceService),
    __metadata("design:type", workspace_service_1.WorkspaceService)
], ProtoIdeContribution.prototype, "workspaceService", void 0);
__decorate([
    (0, inversify_1.inject)(browser_1.OpenerService),
    __metadata("design:type", Object)
], ProtoIdeContribution.prototype, "openerService", void 0);
__decorate([
    (0, inversify_1.inject)(common_1.MessageService),
    __metadata("design:type", common_1.MessageService)
], ProtoIdeContribution.prototype, "messageService", void 0);
exports.ProtoIdeContribution = ProtoIdeContribution = __decorate([
    (0, inversify_1.injectable)()
], ProtoIdeContribution);
//# sourceMappingURL=proto-ide-contribution.js.map