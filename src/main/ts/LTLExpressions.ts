module ayttm {

    export enum ExpressionType {
        Proposition,
        Not,
        And,
        Or,
        Until,
        Release,
        Next
    }

    export class Expression {

        private static counter : number = 0;

        public id : string;

        constructor (public type : ExpressionType){
            Expression.counter = Expression.counter + 1;
            this.id = "Exp_" + Expression.counter.toString();
        }

        public subExpression1() : Expression {
            return undefined;
        }
        public subExpression2() : Expression {
            return undefined;
        }

        public toString() {return this.id;}
        public toPrettyString() {return this.id;}
    }

    export class UnaryExpression extends Expression {
        constructor(public exp : Expression, public type : ExpressionType){
            super(type);
        }

        public subExpression1() : Expression {
            return this.exp;
        }

        public toPrettyString() {
            return ExpressionType[this.type] + " (" + this.subExpression1().toPrettyString() + ")";
        }
    }

    export class BinaryExpression extends Expression {
        constructor(public exp1 : Expression, public exp2 : Expression, public type : ExpressionType) {
            super(type);
        }

        public subExpression1() : Expression {
            return this.exp1;
        }
        public subExpression2() : Expression {
            return this.exp2;
        }

        public toPrettyString() {
            return "(" + this.subExpression1().toPrettyString() + " " + ExpressionType[this.type] + " " + this.subExpression2().toPrettyString() + ")";
        }
    }

    export interface PropositionAsEvent {
        name : string;
        css? : string;
        trigger? : (LTLEvent) => void;
        filter? : (LTLEvent) => boolean;
    }

    export class Proposition extends Expression {

        constructor(public event : PropositionAsEvent) {
            super(ExpressionType.Proposition);
        }

        public matches(message : LTLEvent) {
            return LTLEvents.TrueEvent.name === this.event.name  ||
            (
            (message.name === this.event.name && (!(LTLEvents.isDOMEvent(message) && this.isDOMEvent()) || message.css === this.event.css))
            && (!this.hasFilter() || this.event.filter(message))
            );
        }

         public toPrettyString() {
            return this.event.name + (this.event.css ? ':' + this.event.css : '') + (this.hasTrigger() ? ':Trigger' : '');
         }

         public hasTrigger() {
            return this.event.trigger != undefined;
         }

          private hasFilter() {
             return this.event.filter != undefined;
          }

         public applyTrigger(message : LTLEvent) {
            if (this.hasTrigger()) {
                this.event.trigger(message);
            }
         }

         public isDOMEvent() {
            return this.event.css != undefined;
         }
    }

    /**
     *  this.trigger depends on UIDocumentService.
     *  i.e. this.trigger = this.symbolicTrigger.callback(someDocumentService);
     */
    export class PropositionWithSymbolicTrigger extends Proposition {

         constructor(public event : PropositionAsEvent, public symbolicTrigger : SymbolicTrigger) {
            super(event);
         }
    }


    export class Not extends UnaryExpression {
        constructor(public exp : Expression) {
            super(exp, ExpressionType.Not);
        }
    }

    export class Next extends UnaryExpression {
        constructor(public exp : Expression) {
            super(exp, ExpressionType.Next);
        }
    }

    export class And extends BinaryExpression {
        constructor(public exp1 : Expression, public exp2 : Expression) {
            super(exp1, exp2, ExpressionType.And);
        }
    }

    export class Or extends BinaryExpression {
        constructor(public exp1 : Expression, public exp2 : Expression) {
            super(exp1, exp2, ExpressionType.Or);
        }
    }

    export class Until extends BinaryExpression {
        constructor(public exp1 : Expression, public exp2 : Expression) {
            super(exp1, exp2, ExpressionType.Until);
        }
    }

    export class Release extends BinaryExpression {
        constructor(public exp1 : Expression, public exp2 : Expression) {
            super(exp1, exp2, ExpressionType.Release);
        }
    }

    export var True = new Proposition(LTLEvents.TrueEvent);
    export var False = new Proposition(LTLEvents.FalseEvent);
    export var Timeout = new Proposition(LTLEvents.TimeoutEvent);

    export function checkForRestrictionsOnTriggers(e : Expression) {
        switch (e.type) {
            case ExpressionType.Next :
                return checkForRestrictionsOnTriggers(e.subExpression1());
                break;
            case ExpressionType.Not :
                var subExpression = e.subExpression1();
                switch (subExpression.type) {
                    case ExpressionType.Proposition : return !(<Proposition> subExpression).hasTrigger();
                }
                return checkForRestrictionsOnTriggers(subExpression);
            case ExpressionType.Proposition : return true;
            case ExpressionType.Or :
            case ExpressionType.And : return checkForRestrictionsOnTriggers(e.subExpression1()) && checkForRestrictionsOnTriggers(e.subExpression2());
            case ExpressionType.Until :
            case ExpressionType.Release :
                return (!hasTriggers(e.subExpression1()) && checkForRestrictionsOnTriggers(e.subExpression2()))  ||
                       (!hasTriggers(e.subExpression2()) && checkForRestrictionsOnTriggers(e.subExpression1()))
        }
    }

    function hasTriggers(e : Expression) {
        switch (e.type) {
            case ExpressionType.Next :
            case ExpressionType.Not : return hasTriggers(e.subExpression1());
            case ExpressionType.Proposition : return (<Proposition> e).hasTrigger();
            case ExpressionType.Or :
            case ExpressionType.Until :
            case ExpressionType.And :
            case ExpressionType.Release :
                return hasTriggers(e.subExpression1()) || hasTriggers(e.subExpression2());
        }
    }
}