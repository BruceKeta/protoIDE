"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtoAppOpenHandler = void 0;
const inversify_1 = require("@theia/core/shared/inversify");
const widget_open_handler_1 = require("@theia/core/lib/browser/widget-open-handler");
const proto_model_1 = require("../common/proto-model");
const proto_app_editor_widget_1 = require("./proto-app-editor-widget");
/** Ouvre les fichiers *.protoapp dans l'éditeur ProtoIDE (prioritaire sur l'éditeur texte). */
let ProtoAppOpenHandler = class ProtoAppOpenHandler extends widget_open_handler_1.WidgetOpenHandler {
    constructor() {
        super(...arguments);
        this.id = proto_app_editor_widget_1.ProtoAppEditorWidget.ID;
        this.label = 'Éditeur d\'application ProtoIDE';
    }
    canHandle(uri) {
        return uri.path.ext === proto_model_1.PROTO_APP_EXTENSION ? 500 : 0;
    }
    createWidgetOptions(uri) {
        return { uri: uri.withoutFragment().toString() };
    }
};
exports.ProtoAppOpenHandler = ProtoAppOpenHandler;
exports.ProtoAppOpenHandler = ProtoAppOpenHandler = __decorate([
    (0, inversify_1.injectable)()
], ProtoAppOpenHandler);
//# sourceMappingURL=proto-app-open-handler.js.map