module ayttm {

    class State {

        public final = false;

        constructor (
            public name : string,
            public out : Set<State>,
            public propositions : Array<Proposition>,
            public negatedPropositions : Array<Proposition>
        ) {

        }

        public toString(){
            return this.name;
        }

        public toPrettyString(){
            return "{ name: "  + this.name +
            ", propositions : {" + this.propositions.map(p => p.toPrettyString()).join(",") + "}" +
            ", negatedPropositions : {" + this.negatedPropositions.map(p => p.toPrettyString()).join(",") + "}" +
            ", out : {" + this.out.toArray().map(state => state.name).join(", ") + "}" + " }" +
            ", final : "+this.final+"}\n";
        }

        public static initialState(){
            return new State(GraphNode.initialNodeName, Set.empty<State>(), new Array<Proposition>(), new Array<Proposition>());
        }
    }

    export class Automaton implements LTLEventListener {

        private currentStates : Set<State>;
        private initialState : State;
        private states : Set<State>;
        private documentService = new BasicUIDocumentService(this);
        private lastLTLEvent : LTLEvent;

        private lastEvents = new Map<Event>();

        public static fromExpression(expression : Expression) : Automaton {
            if (!checkForRestrictionsOnTriggers(expression)) {
                throw 'Expression cannot contain triggers in both subexpressions of And, Until or Release. ' + expression.toPrettyString();
            }
            Logger.debug("Generating automaton for:");
            Logger.debug(expression);
            var automaton = this.fromGraphNodes(GraphFactory.createGraph(expression));
            automaton.addListenersToDocumentFromExpression(expression);
            return automaton;
        }

        public static fromGraphNodes(graphNodes : Set<GraphNode>) {

            var graphNodesArray = graphNodes.toArray();
            var states = Set.empty<State>();

            graphNodesArray.forEach(
                graphNode => {
                    states.add(new State(
                        graphNode.name,
                        Set.empty<State>(),
                        <Array<Proposition>> graphNode.oldExpressions.filter(expression => {return expression.type == ExpressionType.Proposition && expression !== True;}).toArray(),
                        <Array<Proposition>> graphNode.oldExpressions.filter(expression => {return expression.type == ExpressionType.Not && expression.subExpression1().type == ExpressionType.Proposition;}).toArray().map((e : Expression) => {return e.subExpression1();})
                    ));
                }
            );

            var automaton = new Automaton();
            automaton.initialState = State.initialState();

            states.add(automaton.initialState);

            graphNodesArray.forEach(
                graphNode => {
                    graphNode.incomingNodes.toArray().forEach(
                        otherNode => {
                            var state = states.valueForKey(graphNode.name);
                            var otherState = states.valueForKey(otherNode.name);
                            otherState.out.add(state);
                        }
                    );
                }
            );

            var finalStates = states.filter(state => state.propositions.length === 0 && state.negatedPropositions.length === 0 && state.out.size() == 1 && state.out.contains(state));
            states.toArray().forEach(state => {state.final = state.out.intersects(finalStates);});

            automaton.currentStates = Set.singleton<State>(automaton.initialState);
            automaton.states = states;
            Logger.debug("Generated automaton:");
            Logger.debug(automaton);
            return automaton;
        }

        public toString() {
            return this.states.toArray().map(state => {return state.toPrettyString();}).join(', ');
        }

        private keyForLTLEvent(event : LTLEvent) {
            return [event.name, event.css].toString();
        }

        public accept(event : LTLEvent) {

            Logger.debug("Received " + (event.css ? event.css +":" : '') + event.name);


            var lastEventFromMap = this.lastEvents.valueForKey(this.keyForLTLEvent(event));
            event.previousEvent = lastEventFromMap ? lastEventFromMap : event.source;
            event.otherPreviousEvent = this.lastLTLEvent ? this.lastLTLEvent.source : event.source;

            var outStates = Set.empty<State>();
            this.currentStates.toArray().forEach( currentState => {
                this.currentStates.remove(currentState);
                outStates.addAll(currentState.out);
            });

            outStates.toArray().forEach(
                outState => {
                    if (this.eventDoesSatisfyState(event, outState)) {
                        this.currentStates.add(outState);
                    }
                }
            );

            var statesWithPropositions = this.currentStates.toArray().filter(s => s.propositions.length > 0);
            if (statesWithPropositions.length > 0) {
                this.currentStates = Set.fromArray<State>(statesWithPropositions);
            }

            if (this.currentStates.filter(state => state.final).size() > 0) {
                Logger.debug("Reached a final state.");
                Logger.debug("Reset.");
                this.currentStates.clear();
                this.currentStates.add(this.initialState);
                this.documentService.clearTimeout();
            }
            if (this.currentStates.isEmpty()) {
                Logger.debug((event.css ? event.css +":" : '') + event.name + " rejected. Reset.");
                this.currentStates.add(this.initialState);
                this.documentService.clearTimeout();
            } else {
                this.lastLTLEvent = event;
                this.lastEvents.put(this.keyForLTLEvent(event), event.source);
            }

            Logger.debug("New current States are:\n ");
            this.currentStates.toArray().forEach(s => {Logger.debug("\t"+s.name+"\n");});
        }

        private eventDoesSatisfyState(event : LTLEvent, state : State) {

            for (var i in state.negatedPropositions) {
                if (state.negatedPropositions[i].matches(event)) {
                    return false;
                }
            }

            var propositionsWithTriggers = new Array<Proposition>();
            for(var i in state.propositions) {
                if (!state.propositions[i].matches(event)) {
                    return false;
                }
                if (state.propositions[i].hasTrigger()) {
                    propositionsWithTriggers.push(state.propositions[i]);
                }
            }

            propositionsWithTriggers.forEach(p => {p.applyTrigger(event);});

        //    Logger.debug(state.name + " accepted " + (event.css ? event.css +":" : '') + event.name);

            return true;
        }

        private addListenersToDocumentFromExpression(expression : Expression) {
            var events = Set.empty<Array<string>>();
            var stack = new Array<Expression>();
            stack.push(expression);

            while (stack.length > 0) {
                var e = stack.pop();
                switch (e.type) {
                    case ExpressionType.Next :
                    case ExpressionType.Not :
                        stack.push(e.subExpression1());
                        break;
                    case ExpressionType.Proposition :
                        if (e instanceof PropositionWithSymbolicTrigger) {
                            (<PropositionWithSymbolicTrigger> e).event.trigger = (<PropositionWithSymbolicTrigger> e).symbolicTrigger.callbackFromDocumentService(this.documentService);
                        }
                        if ((<Proposition> e).isDOMEvent() && !events.contains([(<Proposition> e).event.css, (<Proposition> e).event.name])) {
                            this.documentService.addListenerToDocumentElements((<Proposition> e).event.css, (<Proposition> e).event.name);
                            events.add([(<Proposition> e).event.css, (<Proposition> e).event.name]);
                        }
                        break;
                    case ExpressionType.Or :
                    case ExpressionType.Until :
                    case ExpressionType.And :
                    case ExpressionType.Release :
                        stack.push(e.subExpression1());
                        stack.push(e.subExpression2());
                }
            }
        }
    }
}
