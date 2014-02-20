
module ayttm {

    export interface Ayttm {
        (any?): ExpressionBuilder;
        someValue: number;
        mousemoveTracker(targetSelector : string, containerSelector : string);
        timer(milliseconds : number) : SymbolicTrigger;
        toggleClass(target : string, cssClass : string) : SymbolicTrigger;
        addClass(target : string, cssClass : string) : SymbolicTrigger;
        removeClass(target : string, cssClass : string) : SymbolicTrigger;
        timout() : PropositionAsEvent;
    }

    export var _ = <Ayttm> function (p? : any) {
        return new ExpressionBuilder()._(p);
    };

    // triggers
    _.mousemoveTracker = (targetSelector : string, containerSelector : string) => new TrackMouseMovement(targetSelector, containerSelector);
    _.timer = (milliseconds) => new StartTimer(milliseconds);
    _.toggleClass = (target : string, cssClass : string) => new ToggleClass(target, cssClass);
    _.addClass = (target : string, cssClass : string) => new AddClass(target, cssClass);
    _.removeClass = (target : string, cssClass : string) => new RemoveClass(target, cssClass);

    // propositions
    _.timout = () => { return { name : 'timeout' }; } //LTLEvents.TimeoutEvent;

    interface ExpressionOrExpressionType {
        expression? : Expression;
        type? : ExpressionType;
    }

    export class ExpressionBuilder {

        private expressionStack = new Array<ExpressionOrExpressionType>();
        private expression : Expression;
        private propositionForTrigger : PropositionAsEvent;
        private cssSelector : string;
        private eventType : string;

        public  buildExpression() : Expression {
            if (this.expressionStack.length > 0) {
                this.expression = this.unwindTheStack();
            }
            return this.expression;
        }

        public and(e? : any) {
            this.pushBinaryExpressionsToStack(ExpressionType.And, e);
            return this;
        }

        public or(e? : any) {
            this.pushBinaryExpressionsToStack(ExpressionType.Or, e);
            return this;
        }

        public until(e? : any) {
            this.pushBinaryExpressionsToStack(ExpressionType.Until, e);
            return this;
        }

        public release(e? : any) {
            this.pushBinaryExpressionsToStack(ExpressionType.Release, e);
            return this;
        }

        public next(e? : any) {
            this.pushUnaryExpressionsToStack(ExpressionType.Next, e);
            return this;
        }

        public not(e? : any) {
            this.pushUnaryExpressionsToStack(ExpressionType.Not, e);
            return this;
        }

        public unshift(type : ExpressionType) {
            this.expressionStack.unshift({type:type});
        }

        private pushUnaryExpressionsToStack(type : ExpressionType, e? : any) {
            if (e) {
                if (e instanceof ExpressionBuilder) {
                    (<ExpressionBuilder> e).unshift(type);
                } else {
                    var eb = _();
                    eb.expressionStack.push({type:type});
                    eb.expressionStack.push({expression: this.expressionFromObject(e)});
                    e = this.expressionFromObject(eb);
                }

                this.expressionStack.push({expression: this.expressionFromObject(e)});
            } else {
                this.expressionStack.push({type: type});
            }
        }

        private pushBinaryExpressionsToStack(type : ExpressionType, e? : any) {
            if (e) {
                this.expressionStack.push({type: type}, {expression: this.expressionFromObject(e)});
            } else {
                this.expressionStack.push({type: type});
            }
        }

        private expressionFromObject(e : any) {
            if (e instanceof Expression) {
                return e;
            }
            if (e instanceof ExpressionBuilder) {
                return (<ExpressionBuilder> e).buildExpression();
            }
            if (e instanceof Array) {
                var a = <Array<any>> e;
                var disjuncts;
                if (a.length > 0) {
                    disjuncts = this.expressionFromObject(a[0]);
                    for (var i = 1; i < a.length; ++i) {
                        disjuncts = new Or(disjuncts, this.expressionFromObject(a[i]));
                    }
                    return disjuncts;
                }
            }

            if (e.name) { // PropositionAsEvent
                return new Proposition(e);
            }
            Logger.error('illegal argument ' + e.toString());
        }

        public _(e : any) {
            if (e) {
                if (typeof e === 'object') {
                    this.expressionStack.push({expression : this.expressionFromObject(e)});
                } else if (typeof e === 'string') {
                    this.cssSelector = <string> e;
                }
            }
            return this;
        }

        public with(t : any) {
            var p = this.expressionStack.pop();
            if (!p || ! p.expression || ! (p.expression instanceof Proposition)) {
                throw 'Illegal state: with must be called on a proposition';
            }
            if (typeof t === 'object' && t.callbackFromDocumentService) {
                this.expressionStack.push({expression : new PropositionWithSymbolicTrigger((<Proposition> p.expression).event, t)});
            } else if (typeof t === 'function') {
                (<Proposition> p.expression).event.trigger = <(LTLEvent) => void> t;
                this.expressionStack.push(p);
            } else {
                throw 'Illegal argument: with(t) expects t to be a trigger argument';
            }

            return this;
        }

        private unwindTheStack() : Expression {
            var currentExpression : Expression;
            var currentBinaryExpressionType : ExpressionType;
            while (this.expressionStack.length > 0) {
                var item = this.expressionStack.pop();
                if (item.type) {
                    switch (item.type) {
                        case ExpressionType.Not : currentExpression = new Not(currentExpression);
                        break;
                        case ExpressionType.Next : currentExpression = new Next(currentExpression);
                        break;
                        case ExpressionType.And :
                        case ExpressionType.Or :
                        case ExpressionType.Until :
                        case ExpressionType.Release : currentBinaryExpressionType = item.type;
                        break;
                    }
                } else { // item.expression
                    if (currentBinaryExpressionType) {
                        switch (currentBinaryExpressionType) {
                            case ExpressionType.And : currentExpression = new And(item.expression, currentExpression);
                            break;
                            case ExpressionType.Or : currentExpression = new Or(item.expression, currentExpression);
                            break;
                            case ExpressionType.Until : currentExpression = new Until(item.expression, currentExpression);
                            break;
                            case ExpressionType.Release : currentExpression = new Release(item.expression, currentExpression);
                            break;
                        }
                        currentBinaryExpressionType = undefined;
                    } else {
                        currentExpression = item.expression;
                    }
                }
            }
            return currentExpression;
        }

        public __() {
            Automaton.fromExpression(this.buildExpression());
        }

        public andNext(e? : any) {
             this.and();
             this.next(e);
             return this;
        }

        public filter(f: (LTLEvent) => boolean) {
            var p = this.expressionStack.pop();
            if (p && p.expression && p.expression instanceof Proposition) {
                (<Proposition>p.expression).event.filter =  f;
                this.expressionStack.push(p);
                return this;
            }
            throw 'Illegal state exception: filter must be applied to a proposition.';
        }

        public abort() {     //	UIEvent
            this._({name : 'abort', css: this.cssSelector});
            return this;
        }
        public DOMActivate() { //	UIEvent
            this._({name : 'DOMActivate', css: this.cssSelector});
            return this;
        }
        public error() {     //	UIEvent
            this._({name : 'error', css: this.cssSelector});
            return this;
        }
        public load() {     //	UIEvent
            this._({name : 'load', css: this.cssSelector});
            return this;
        }
        public resize() {     //	UIEvent
            this._({name : 'resize', css: this.cssSelector});
            return this;
        }
        public scroll() {     //	UIEvent
            this._({name : 'scroll', css: this.cssSelector});
            return this;
        }
        public select() {     //	UIEvent
            this._({name : 'select', css: this.cssSelector});
            return this;
        }
        public unload() {     //	UIEvent
            this._({name : 'unload', css: this.cssSelector});
            return this;
        }
        public wheel() {     //	WheelEvent
            this._({name : 'wheel', css: this.cssSelector});
            return this;
        }
        public keydown() {     //	KeyboardEvent
            this._({name : 'keydown', css: this.cssSelector});
            return this;
        }

        public shiftkeydown() {     //	KeyboardEvent
            this._({name : 'keydown', css: this.cssSelector, filter: (e: LTLEvent) => (<KeyboardEvent> e.source).shiftKey});
            return this;
        }

        public shiftkeyup() {     //	KeyboardEvent
            this._({name : 'keyup', css: this.cssSelector, filter: (e: LTLEvent) => (<KeyboardEvent> e.source).shiftKey});
            return this;
        }

        public keypress() {     //	KeyboardEvent
            this._({name : 'keypress', css: this.cssSelector});
            return this;
        }
        public keyup() {     //	KeyboardEvent
            this._({name : 'keyup', css: this.cssSelector});
            return this;
        }
        public touchcancel() {     //	TouchEvent
            this._({name : 'touchcancel', css: this.cssSelector});
            return this;
        }
        public touchend() {     //	TouchEvent
            this._({name : 'touchend', css: this.cssSelector});
            return this;
        }
        public touchenter() {     //	TouchEvent
            this._({name : 'touchenter', css: this.cssSelector});
            return this;
        }
        public touchleave() {     //	TouchEvent
            this._({name : 'touchleave', css: this.cssSelector});
            return this;
        }
        public touchmove() {     //	TouchEvent
            this._({name : 'touchmove', css: this.cssSelector});
            return this;
        }
        public touchstart() {     //	TouchEvent
            this._({name : 'touchstart', css: this.cssSelector});
            return this;
        }
        public transitionend() {     //	TransitionEvent
            this._({name : 'transitionend', css: this.cssSelector});
            return this;
        }
        public click() {     //	MouseEvent
            this._({name : 'click', css: this.cssSelector});
            return this;
        }
        public contextmenu() {     //	MouseEvent
            this._({name : 'contextmenu', css: this.cssSelector});
            return this;
        }
        public dblclick() {     //	MouseEvent
            this._({name : 'dblclick', css: this.cssSelector});
            return this;
        }
        public mousedown() {     //	MouseEvent
            this._({name : 'mousedown', css: this.cssSelector});
            return this;
        }
        public mouseenter() {     //	MouseEvent
            this._({name : 'mouseenter', css: this.cssSelector});
            return this;
        }
        public mouseleave() {     //	MouseEvent
            this._({name : 'mouseleave', css: this.cssSelector});
            return this;
        }
        public mousemove() {     //	MouseEvent
            this._({name : 'mousemove', css: this.cssSelector});
            return this;
        }
        public mouseout() {     //	MouseEvent
            this._({name : 'mouseout', css: this.cssSelector});
            return this;
        }
        public mouseover() {     //	MouseEvent
            this._({name : 'mouseover', css: this.cssSelector});
            return this;
        }
        public mouseup() {     //	MouseEvent
            this._({name : 'mouseup', css: this.cssSelector});
            return this;
        }
        public show() {     //	MouseEvent
            this._({name : 'show', css: this.cssSelector});
            return this;
        }

        public onchange() {     //	MouseEvent
            this._({name : 'onchange', css: this.cssSelector});
            return this;
        }
    }

}

