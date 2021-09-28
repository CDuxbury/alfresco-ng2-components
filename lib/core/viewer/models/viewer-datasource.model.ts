import {
    HyViewerDataSource,
    VrtlContentItem,
    VrtlDocument,
    VrtlSmoothScrollProjection
} from '@hyland/ui';
import { of } from 'rxjs';
import { ViewerImageProjectionComponent } from '../projections/image-projection';


export class AdfViewerDataSource implements HyViewerDataSource {
    constructor(
        private documentId:string,
        private contentItemCount:number
    ){
    }

    public loadDocument$(){
        const {
            documentId,
            contentItemCount
        } = this;

        return of({
            documentId,
            contentItemCount
        });
    }

    public resolveDocumentProjection(_vrtlDocument:VrtlDocument) {
        return VrtlSmoothScrollProjection;
    }

    public resolveContentItemProjection(_vrtlDocument:VrtlDocument, _item:VrtlContentItem) {
        return ViewerImageProjectionComponent;
    }
}
