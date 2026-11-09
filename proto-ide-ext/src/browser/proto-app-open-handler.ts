import { injectable } from '@theia/core/shared/inversify';
import { WidgetOpenHandler } from '@theia/core/lib/browser/widget-open-handler';
import URI from '@theia/core/lib/common/uri';
import { PROTO_APP_EXTENSION } from '../common/proto-model';
import { ProtoAppEditorOptions, ProtoAppEditorWidget } from './proto-app-editor-widget';

/** Ouvre les fichiers *.protoapp dans l'éditeur ProtoIDE (prioritaire sur l'éditeur texte). */
@injectable()
export class ProtoAppOpenHandler extends WidgetOpenHandler<ProtoAppEditorWidget> {

    readonly id = ProtoAppEditorWidget.ID;
    readonly label = 'Éditeur d\'application ProtoIDE';

    canHandle(uri: URI): number {
        return uri.path.ext === PROTO_APP_EXTENSION ? 500 : 0;
    }

    protected createWidgetOptions(uri: URI): ProtoAppEditorOptions {
        return { uri: uri.withoutFragment().toString() };
    }
}
