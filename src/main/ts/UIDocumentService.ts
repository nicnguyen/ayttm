module ayttm {

    export interface UIDocumentService {
        startTimer(milliseconds : number);
        clearTimeout();
        addListenerToDocumentElements(cssSelector : string, eventName : string);
        addClass(cssSelector : string, cssClass : string);
        removeClass(cssSelector : string, cssClass : string);
        toggleClass(cssSelector : string, cssClass : string);
        trackMouseMovement(cssSelector : string, containerSelector: string, event : LTLEvent);
    }

    export class BasicUIDocumentService implements UIDocumentService {

        private timeoutId : number;

        constructor(private eventListener : LTLEventListener) {
        }

        public startTimer(milliseconds : number) {
            this.clearTimeout();
            this.timeoutId = setTimeout(() => {this.eventListener.accept(LTLEvents.TimeoutEvent);}, milliseconds);
            Logger.debug("Started timeout " + this.timeoutId);
        }

        public clearTimeout() {
            if (this.timeoutId != undefined) {
                Logger.debug("Clearing timeout " + this.timeoutId);
                clearTimeout(this.timeoutId);
                this.timeoutId = undefined;
            }
        }

        public applyToQueryResult(cssSelector : string, f : (HTMLElement) => void) {
            var items = document.querySelectorAll(cssSelector);
            for (var i = 0; i < items.length; ++i) {
                f(items.item(i));
            }
        }

        public addListenerToDocumentElements(cssSelector : string, eventName : string) {
            this.applyToQueryResult(
                cssSelector,
                element => {
                element.addEventListener(
                    eventName,
                    (event : Event) => {
                        this.eventListener.accept({name: eventName, css: cssSelector, source: event});
                    }
                );
            });
        }

        public addClass(cssSelector : string, cssClass : string) {
            this.applyToQueryResult(
                cssSelector,
                element => {
                    if (!element.classList.contains(cssClass)) {
                        element.classList.add(cssClass);
                        Logger.debug("Added " + cssClass + " on " + cssSelector);
                    } else {
                        Logger.debug(cssSelector + " already has " + cssClass);
                    }
                }
            );
        }

        public removeClass(cssSelector : string, cssClass : string) {
            this.applyToQueryResult(
                cssSelector,
                element => {
                    element.classList.remove(cssClass);
                    Logger.debug("Removed " + cssClass + " on " + cssSelector);
                }
            );
        }

        public toggleClass(cssSelector : string, cssClass : string) {
            this.applyToQueryResult(cssSelector,
                element => {
                    element.classList.toggle(cssClass);
                }
            );
        }

        public show(cssSelector : string) {
            this.css(cssSelector, 'display', 'block');
        }

        public hide(cssSelector : string) {
            this.css(cssSelector, 'display', 'none');
        }

        public css(cssSelector : string, property : string, value : string) {
            this.applyToQueryResult(cssSelector,
                element => {
                    element.style[property] = value;
                }
            );
        }

        public trackMouseMovement(cssSelector : string, containerSelector: string,  event : LTLEvent) {

            var container = document.querySelector(containerSelector);
            var cr = container.getBoundingClientRect();
            this.applyToQueryResult(cssSelector,
                element => {
                    var top = this.numberFromPixels(element.style.top? element.style.top : element.offsetTop);
                    var left = this.numberFromPixels(element.style.left? element.style.left : element.offsetLeft);
                    var width = this.numberFromPixels(element.style.width? element.style.width : element.offsetWidth);
                    var height = this.numberFromPixels(element.style.height? element.style.height : element.offsetHeight);
                    element.style.top = Math.min(cr.top + cr.height - height, Math.max(cr.top, (top + ((<MouseEvent>event.source).clientY - (<MouseEvent>event.otherPreviousEvent).clientY))))+ 'px';
                    element.style.left = Math.min(cr.left + cr.width - width, Math.max(cr.left,(left + ((<MouseEvent>event.source).clientX - (<MouseEvent>event.otherPreviousEvent).clientX))))+ 'px';
                }
            );
        }

        private numberFromPixels(v : any){
            if (typeof v === 'number') {
                return v;
            }
            if (typeof v === 'string') {
                return parseInt(v.replace('px',''))
            }
        }
    }
}