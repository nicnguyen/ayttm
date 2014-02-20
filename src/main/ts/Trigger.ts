module ayttm {

    export interface SymbolicTrigger {
        callbackFromDocumentService(documentService : UIDocumentService) : (LTLEvent) => void;
    }

    export class StartTimer implements SymbolicTrigger {
        constructor(public milliseconds : number) {}
        public callbackFromDocumentService(documentService : UIDocumentService) {
            return (event:LTLEvent) => {documentService.startTimer(this.milliseconds);};
        }
    }

    export class AddClass implements SymbolicTrigger {
        constructor(public cssSelector : string, public cssClass : string) {}

        public callbackFromDocumentService(documentService : UIDocumentService) {
            return (event:LTLEvent) => {documentService.addClass(this.cssSelector, this.cssClass);};
        }
    }

    export class RemoveClass implements SymbolicTrigger {
        constructor(public cssSelector : string, public cssClass : string) {}

        public callbackFromDocumentService(documentService : UIDocumentService) {
            return (event:LTLEvent) => {documentService.removeClass(this.cssSelector, this.cssClass);};
        }
    }

    export class ToggleClass implements SymbolicTrigger {
        constructor(public cssSelector : string, public cssClass : string) {}

        public callbackFromDocumentService(documentService : UIDocumentService) {
            return (event:LTLEvent) => {documentService.toggleClass(this.cssSelector, this.cssClass);};
        }
    }

    export class TrackMouseMovement implements SymbolicTrigger {
        constructor(public cssSelector : string, public containerSelector : string) {}

        public callbackFromDocumentService(documentService : UIDocumentService) {
            return (event:LTLEvent) => {documentService.trackMouseMovement(this.cssSelector, this.containerSelector, event);};
        }
    }
}