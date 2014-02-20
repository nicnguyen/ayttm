var ayttm;
(function (ayttm) {
    var State = (function () {
        function State(name, out, propositions, negatedPropositions) {
            this.name = name;
            this.out = out;
            this.propositions = propositions;
            this.negatedPropositions = negatedPropositions;
            this.final = false;
        }
        State.prototype.toString = function () {
            return this.name;
        };

        State.prototype.toPrettyString = function () {
            return "{ name: " + this.name + ", propositions : {" + this.propositions.map(function (p) {
                return p.toPrettyString();
            }).join(",") + "}" + ", negatedPropositions : {" + this.negatedPropositions.map(function (p) {
                return p.toPrettyString();
            }).join(",") + "}" + ", out : {" + this.out.toArray().map(function (state) {
                return state.name;
            }).join(", ") + "}" + " }" + ", final : " + this.final + "}\n";
        };

        State.initialState = function () {
            return new State(ayttm.GraphNode.initialNodeName, ayttm.Set.empty(), new Array(), new Array());
        };
        return State;
    })();

    var Automaton = (function () {
        function Automaton() {
            this.documentService = new ayttm.BasicUIDocumentService(this);
            this.lastEvents = new ayttm.Map();
        }
        Automaton.fromExpression = function (expression) {
            if (!ayttm.checkForRestrictionsOnTriggers(expression)) {
                throw 'Expression cannot contain triggers in both subexpressions of And, Until or Release. ' + expression.toPrettyString();
            }
            ayttm.Logger.debug("Generating automaton for:");
            ayttm.Logger.debug(expression);
            var automaton = this.fromGraphNodes(ayttm.GraphFactory.createGraph(expression));
            automaton.addListenersToDocumentFromExpression(expression);
            return automaton;
        };

        Automaton.fromGraphNodes = function (graphNodes) {
            var graphNodesArray = graphNodes.toArray();
            var states = ayttm.Set.empty();

            graphNodesArray.forEach(function (graphNode) {
                states.add(new State(graphNode.name, ayttm.Set.empty(), graphNode.oldExpressions.filter(function (expression) {
                    return expression.type == 0 /* Proposition */ && expression !== ayttm.True;
                }).toArray(), graphNode.oldExpressions.filter(function (expression) {
                    return expression.type == 1 /* Not */ && expression.subExpression1().type == 0 /* Proposition */;
                }).toArray().map(function (e) {
                    return e.subExpression1();
                })));
            });

            var automaton = new Automaton();
            automaton.initialState = State.initialState();

            states.add(automaton.initialState);

            graphNodesArray.forEach(function (graphNode) {
                graphNode.incomingNodes.toArray().forEach(function (otherNode) {
                    var state = states.valueForKey(graphNode.name);
                    var otherState = states.valueForKey(otherNode.name);
                    otherState.out.add(state);
                });
            });

            var finalStates = states.filter(function (state) {
                return state.propositions.length === 0 && state.negatedPropositions.length === 0 && state.out.size() == 1 && state.out.contains(state);
            });
            states.toArray().forEach(function (state) {
                state.final = state.out.intersects(finalStates);
            });

            automaton.currentStates = ayttm.Set.singleton(automaton.initialState);
            automaton.states = states;
            ayttm.Logger.debug("Generated automaton:");
            ayttm.Logger.debug(automaton);
            return automaton;
        };

        Automaton.prototype.toString = function () {
            return this.states.toArray().map(function (state) {
                return state.toPrettyString();
            }).join(', ');
        };

        Automaton.prototype.keyForLTLEvent = function (event) {
            return [event.name, event.css].toString();
        };

        Automaton.prototype.accept = function (event) {
            var _this = this;
            ayttm.Logger.debug("Received " + (event.css ? event.css + ":" : '') + event.name);

            var lastEventFromMap = this.lastEvents.valueForKey(this.keyForLTLEvent(event));
            event.previousEvent = lastEventFromMap ? lastEventFromMap : event.source;
            event.otherPreviousEvent = this.lastLTLEvent ? this.lastLTLEvent.source : event.source;

            var outStates = ayttm.Set.empty();
            this.currentStates.toArray().forEach(function (currentState) {
                _this.currentStates.remove(currentState);
                outStates.addAll(currentState.out);
            });

            outStates.toArray().forEach(function (outState) {
                if (_this.eventDoesSatisfyState(event, outState)) {
                    _this.currentStates.add(outState);
                }
            });

            var statesWithPropositions = this.currentStates.toArray().filter(function (s) {
                return s.propositions.length > 0;
            });
            if (statesWithPropositions.length > 0) {
                this.currentStates = ayttm.Set.fromArray(statesWithPropositions);
            }

            if (this.currentStates.filter(function (state) {
                return state.final;
            }).size() > 0) {
                ayttm.Logger.debug("Reached a final state.");
                ayttm.Logger.debug("Reset.");
                this.currentStates.clear();
                this.currentStates.add(this.initialState);
                this.documentService.clearTimeout();
            }
            if (this.currentStates.isEmpty()) {
                ayttm.Logger.debug((event.css ? event.css + ":" : '') + event.name + " rejected. Reset.");
                this.currentStates.add(this.initialState);
                this.documentService.clearTimeout();
            } else {
                this.lastLTLEvent = event;
                this.lastEvents.put(this.keyForLTLEvent(event), event.source);
            }

            ayttm.Logger.debug("New current States are:\n ");
            this.currentStates.toArray().forEach(function (s) {
                ayttm.Logger.debug("\t" + s.name + "\n");
            });
        };

        Automaton.prototype.eventDoesSatisfyState = function (event, state) {
            for (var i in state.negatedPropositions) {
                if (state.negatedPropositions[i].matches(event)) {
                    return false;
                }
            }

            var propositionsWithTriggers = new Array();
            for (var i in state.propositions) {
                if (!state.propositions[i].matches(event)) {
                    return false;
                }
                if (state.propositions[i].hasTrigger()) {
                    propositionsWithTriggers.push(state.propositions[i]);
                }
            }

            propositionsWithTriggers.forEach(function (p) {
                p.applyTrigger(event);
            });

            //    Logger.debug(state.name + " accepted " + (event.css ? event.css +":" : '') + event.name);
            return true;
        };

        Automaton.prototype.addListenersToDocumentFromExpression = function (expression) {
            var events = ayttm.Set.empty();
            var stack = new Array();
            stack.push(expression);

            while (stack.length > 0) {
                var e = stack.pop();
                switch (e.type) {
                    case 6 /* Next */:
                    case 1 /* Not */:
                        stack.push(e.subExpression1());
                        break;
                    case 0 /* Proposition */:
                        if (e instanceof ayttm.PropositionWithSymbolicTrigger) {
                            e.event.trigger = e.symbolicTrigger.callbackFromDocumentService(this.documentService);
                        }
                        if (e.isDOMEvent() && !events.contains([e.event.css, e.event.name])) {
                            this.documentService.addListenerToDocumentElements(e.event.css, e.event.name);
                            events.add([e.event.css, e.event.name]);
                        }
                        break;
                    case 3 /* Or */:
                    case 4 /* Until */:
                    case 2 /* And */:
                    case 5 /* Release */:
                        stack.push(e.subExpression1());
                        stack.push(e.subExpression2());
                }
            }
        };
        return Automaton;
    })();
    ayttm.Automaton = Automaton;
})(ayttm || (ayttm = {}));
var ayttm;
(function (ayttm) {
    ayttm._ = function (p) {
        return new ExpressionBuilder()._(p);
    };

    // triggers
    ayttm._.mousemoveTracker = function (targetSelector, containerSelector) {
        return new ayttm.TrackMouseMovement(targetSelector, containerSelector);
    };
    ayttm._.timer = function (milliseconds) {
        return new ayttm.StartTimer(milliseconds);
    };
    ayttm._.toggleClass = function (target, cssClass) {
        return new ayttm.ToggleClass(target, cssClass);
    };
    ayttm._.addClass = function (target, cssClass) {
        return new ayttm.AddClass(target, cssClass);
    };
    ayttm._.removeClass = function (target, cssClass) {
        return new ayttm.RemoveClass(target, cssClass);
    };

    // propositions
    ayttm._.timout = function () {
        return { name: 'timeout' };
    };

    var ExpressionBuilder = (function () {
        function ExpressionBuilder() {
            this.expressionStack = new Array();
        }
        ExpressionBuilder.prototype.buildExpression = function () {
            if (this.expressionStack.length > 0) {
                this.expression = this.unwindTheStack();
            }
            return this.expression;
        };

        ExpressionBuilder.prototype.and = function (e) {
            this.pushBinaryExpressionsToStack(2 /* And */, e);
            return this;
        };

        ExpressionBuilder.prototype.or = function (e) {
            this.pushBinaryExpressionsToStack(3 /* Or */, e);
            return this;
        };

        ExpressionBuilder.prototype.until = function (e) {
            this.pushBinaryExpressionsToStack(4 /* Until */, e);
            return this;
        };

        ExpressionBuilder.prototype.release = function (e) {
            this.pushBinaryExpressionsToStack(5 /* Release */, e);
            return this;
        };

        ExpressionBuilder.prototype.next = function (e) {
            this.pushUnaryExpressionsToStack(6 /* Next */, e);
            return this;
        };

        ExpressionBuilder.prototype.not = function (e) {
            this.pushUnaryExpressionsToStack(1 /* Not */, e);
            return this;
        };

        ExpressionBuilder.prototype.unshift = function (type) {
            this.expressionStack.unshift({ type: type });
        };

        ExpressionBuilder.prototype.pushUnaryExpressionsToStack = function (type, e) {
            if (e) {
                if (e instanceof ExpressionBuilder) {
                    e.unshift(type);
                } else {
                    var eb = ayttm._();
                    eb.expressionStack.push({ type: type });
                    eb.expressionStack.push({ expression: this.expressionFromObject(e) });
                    e = this.expressionFromObject(eb);
                }

                this.expressionStack.push({ expression: this.expressionFromObject(e) });
            } else {
                this.expressionStack.push({ type: type });
            }
        };

        ExpressionBuilder.prototype.pushBinaryExpressionsToStack = function (type, e) {
            if (e) {
                this.expressionStack.push({ type: type }, { expression: this.expressionFromObject(e) });
            } else {
                this.expressionStack.push({ type: type });
            }
        };

        ExpressionBuilder.prototype.expressionFromObject = function (e) {
            if (e instanceof ayttm.Expression) {
                return e;
            }
            if (e instanceof ExpressionBuilder) {
                return e.buildExpression();
            }
            if (e instanceof Array) {
                var a = e;
                var disjuncts;
                if (a.length > 0) {
                    disjuncts = this.expressionFromObject(a[0]);
                    for (var i = 1; i < a.length; ++i) {
                        disjuncts = new ayttm.Or(disjuncts, this.expressionFromObject(a[i]));
                    }
                    return disjuncts;
                }
            }

            if (e.name) {
                return new ayttm.Proposition(e);
            }
            ayttm.Logger.error('illegal argument ' + e.toString());
        };

        ExpressionBuilder.prototype._ = function (e) {
            if (e) {
                if (typeof e === 'object') {
                    this.expressionStack.push({ expression: this.expressionFromObject(e) });
                } else if (typeof e === 'string') {
                    this.cssSelector = e;
                }
            }
            return this;
        };

        ExpressionBuilder.prototype.with = function (t) {
            var p = this.expressionStack.pop();
            if (!p || !p.expression || !(p.expression instanceof ayttm.Proposition)) {
                throw 'Illegal state: with must be called on a proposition';
            }
            if (typeof t === 'object' && t.callbackFromDocumentService) {
                this.expressionStack.push({ expression: new ayttm.PropositionWithSymbolicTrigger(p.expression.event, t) });
            } else if (typeof t === 'function') {
                p.expression.event.trigger = t;
                this.expressionStack.push(p);
            } else {
                throw 'Illegal argument: with(t) expects t to be a trigger argument';
            }

            return this;
        };

        ExpressionBuilder.prototype.unwindTheStack = function () {
            var currentExpression;
            var currentBinaryExpressionType;
            while (this.expressionStack.length > 0) {
                var item = this.expressionStack.pop();
                if (item.type) {
                    switch (item.type) {
                        case 1 /* Not */:
                            currentExpression = new ayttm.Not(currentExpression);
                            break;
                        case 6 /* Next */:
                            currentExpression = new ayttm.Next(currentExpression);
                            break;
                        case 2 /* And */:
                        case 3 /* Or */:
                        case 4 /* Until */:
                        case 5 /* Release */:
                            currentBinaryExpressionType = item.type;
                            break;
                    }
                } else {
                    if (currentBinaryExpressionType) {
                        switch (currentBinaryExpressionType) {
                            case 2 /* And */:
                                currentExpression = new ayttm.And(item.expression, currentExpression);
                                break;
                            case 3 /* Or */:
                                currentExpression = new ayttm.Or(item.expression, currentExpression);
                                break;
                            case 4 /* Until */:
                                currentExpression = new ayttm.Until(item.expression, currentExpression);
                                break;
                            case 5 /* Release */:
                                currentExpression = new ayttm.Release(item.expression, currentExpression);
                                break;
                        }
                        currentBinaryExpressionType = undefined;
                    } else {
                        currentExpression = item.expression;
                    }
                }
            }
            return currentExpression;
        };

        ExpressionBuilder.prototype.__ = function () {
            ayttm.Automaton.fromExpression(this.buildExpression());
        };

        ExpressionBuilder.prototype.andNext = function (e) {
            this.and();
            this.next(e);
            return this;
        };

        ExpressionBuilder.prototype.filter = function (f) {
            var p = this.expressionStack.pop();
            if (p && p.expression && p.expression instanceof ayttm.Proposition) {
                p.expression.event.filter = f;
                this.expressionStack.push(p);
                return this;
            }
            throw 'Illegal state exception: filter must be applied to a proposition.';
        };

        ExpressionBuilder.prototype.abort = function () {
            this._({ name: 'abort', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.DOMActivate = function () {
            this._({ name: 'DOMActivate', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.error = function () {
            this._({ name: 'error', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.load = function () {
            this._({ name: 'load', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.resize = function () {
            this._({ name: 'resize', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.scroll = function () {
            this._({ name: 'scroll', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.select = function () {
            this._({ name: 'select', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.unload = function () {
            this._({ name: 'unload', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.wheel = function () {
            this._({ name: 'wheel', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.keydown = function () {
            this._({ name: 'keydown', css: this.cssSelector });
            return this;
        };

        ExpressionBuilder.prototype.shiftkeydown = function () {
            this._({ name: 'keydown', css: this.cssSelector, filter: function (e) {
                    return e.source.shiftKey;
                } });
            return this;
        };

        ExpressionBuilder.prototype.shiftkeyup = function () {
            this._({ name: 'keyup', css: this.cssSelector, filter: function (e) {
                    return e.source.shiftKey;
                } });
            return this;
        };

        ExpressionBuilder.prototype.keypress = function () {
            this._({ name: 'keypress', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.keyup = function () {
            this._({ name: 'keyup', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.touchcancel = function () {
            this._({ name: 'touchcancel', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.touchend = function () {
            this._({ name: 'touchend', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.touchenter = function () {
            this._({ name: 'touchenter', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.touchleave = function () {
            this._({ name: 'touchleave', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.touchmove = function () {
            this._({ name: 'touchmove', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.touchstart = function () {
            this._({ name: 'touchstart', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.transitionend = function () {
            this._({ name: 'transitionend', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.click = function () {
            this._({ name: 'click', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.contextmenu = function () {
            this._({ name: 'contextmenu', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.dblclick = function () {
            this._({ name: 'dblclick', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.mousedown = function () {
            this._({ name: 'mousedown', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.mouseenter = function () {
            this._({ name: 'mouseenter', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.mouseleave = function () {
            this._({ name: 'mouseleave', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.mousemove = function () {
            this._({ name: 'mousemove', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.mouseout = function () {
            this._({ name: 'mouseout', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.mouseover = function () {
            this._({ name: 'mouseover', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.mouseup = function () {
            this._({ name: 'mouseup', css: this.cssSelector });
            return this;
        };
        ExpressionBuilder.prototype.show = function () {
            this._({ name: 'show', css: this.cssSelector });
            return this;
        };

        ExpressionBuilder.prototype.onchange = function () {
            this._({ name: 'onchange', css: this.cssSelector });
            return this;
        };
        return ExpressionBuilder;
    })();
    ayttm.ExpressionBuilder = ExpressionBuilder;
})(ayttm || (ayttm = {}));
var ayttm;
(function (ayttm) {
    var GraphFactory = (function () {
        function GraphFactory() {
        }
        GraphFactory.expand = function (node, nodesSet) {
            if (node.newExpressions.isEmpty()) {
                var otherNode = nodesSet.filterOne(GraphFactory.loopPredicate(node));
                if (otherNode != null) {
                    otherNode.incomingNodes.addAll(node.incomingNodes);
                    return nodesSet;
                }

                var newName = ayttm.GraphNode.newName();
                return GraphFactory.expand(new ayttm.GraphNode(newName, ayttm.Set.singleton(node), node.nextExpressions.clone(), ayttm.Set.empty(), ayttm.Set.empty()), new ayttm.Set().addAll(nodesSet).add(node));
            } else {
                var eta = node.newExpressions.item();
                node.newExpressions.remove(eta);

                if (eta.type == 0 /* Proposition */ || (eta.type == 1 /* Not */ && eta.subExpression1().type == 0 /* Proposition */)) {
                    if (eta === ayttm.False) {
                        return nodesSet;
                    }
                    node.oldExpressions = new ayttm.Set().addAll(node.oldExpressions).add(eta);
                    return GraphFactory.expand(node, nodesSet);
                } else {
                    switch (eta.type) {
                        case 4 /* Until */:
                        case 5 /* Release */:
                        case 3 /* Or */:
                            var node1 = new ayttm.GraphNode(ayttm.GraphNode.newName(), node.incomingNodes.clone(), node.newExpressions.clone().addAll(GraphFactory.new1(eta).removeAll(node.oldExpressions)), node.oldExpressions.clone().add(eta), node.nextExpressions.clone().addAll(GraphFactory.next1(eta)));
                            var node2 = new ayttm.GraphNode(ayttm.GraphNode.newName(), node.incomingNodes.clone(), node.newExpressions.clone().addAll(GraphFactory.new2(eta).removeAll(node.oldExpressions)), node.oldExpressions.clone().add(eta), node.nextExpressions.clone());
                            return GraphFactory.expand(node2, GraphFactory.expand(node1, nodesSet));

                        case 2 /* And */:
                            return GraphFactory.expand(new ayttm.GraphNode(node.name, node.incomingNodes.clone(), node.newExpressions.clone().addAll(ayttm.Set.fromArray([eta.subExpression1(), eta.subExpression2()]).removeAll(node.oldExpressions)), node.oldExpressions.clone().add(eta), node.nextExpressions), nodesSet);
                        case 6 /* Next */:
                            return GraphFactory.expand(new ayttm.GraphNode(node.name, node.incomingNodes.clone(), node.newExpressions.clone(), node.oldExpressions.clone().add(eta), node.nextExpressions.clone().add(eta.subExpression1())), nodesSet);
                    }
                }
            }
        };

        GraphFactory.createGraph = function (expression) {
            ayttm.GraphNode.resetCounter();
            var initialNode = ayttm.GraphNode.initialNode();
            var nodes = GraphFactory.expand(new ayttm.GraphNode(ayttm.GraphNode.newName(), ayttm.Set.singleton(initialNode), ayttm.Set.singleton(GraphFactory.negationNormalForm(expression)), ayttm.Set.empty(), ayttm.Set.empty()), ayttm.Set.empty());

            nodes.add(initialNode);
            return nodes;
        };

        GraphFactory.next1 = function (expression) {
            switch (expression.type) {
                case 4 /* Until */:
                    return new ayttm.Set().add(expression);
                case 5 /* Release */:
                    return new ayttm.Set().add(expression);
                case 3 /* Or */:
                    return new ayttm.Set();
                default:
                    return undefined;
            }
        };

        GraphFactory.new1 = function (expression) {
            switch (expression.type) {
                case 4 /* Until */:
                    return new ayttm.Set().add(expression.subExpression1());
                case 5 /* Release */:
                    return new ayttm.Set().add(expression.subExpression2());
                case 3 /* Or */:
                    return new ayttm.Set().add(expression.subExpression1());
                default:
                    return undefined;
            }
        };

        GraphFactory.new2 = function (expression) {
            switch (expression.type) {
                case 4 /* Until */:
                    return new ayttm.Set().add(expression.subExpression2());
                case 5 /* Release */:
                    return new ayttm.Set().add(expression.subExpression1()).add(expression.subExpression2());
                case 3 /* Or */:
                    return new ayttm.Set().add(expression.subExpression2());
                default:
                    return undefined;
            }
        };

        GraphFactory.negationNormalForm = function (expression) {
            switch (expression.type) {
                case 0 /* Proposition */:
                    return expression;

                case 3 /* Or */:
                    return new ayttm.Or(GraphFactory.negationNormalForm(expression.subExpression1()), GraphFactory.negationNormalForm(expression.subExpression2()));
                case 2 /* And */:
                    return new ayttm.And(GraphFactory.negationNormalForm(expression.subExpression1()), GraphFactory.negationNormalForm(expression.subExpression2()));
                case 4 /* Until */:
                    return new ayttm.Until(GraphFactory.negationNormalForm(expression.subExpression1()), GraphFactory.negationNormalForm(expression.subExpression2()));
                case 5 /* Release */:
                    return new ayttm.Release(GraphFactory.negationNormalForm(expression.subExpression1()), GraphFactory.negationNormalForm(expression.subExpression2()));
                case 6 /* Next */:
                    return new ayttm.Next(GraphFactory.negationNormalForm(expression.subExpression1()));

                case 1 /* Not */: {
                    var subExpression = expression.subExpression1();

                    switch (subExpression.type) {
                        case 3 /* Or */:
                            return new ayttm.And(GraphFactory.negationNormalForm(new ayttm.Not(subExpression.subExpression1())), GraphFactory.negationNormalForm(new ayttm.Not(subExpression.subExpression2())));
                        case 2 /* And */:
                            return new ayttm.Or(GraphFactory.negationNormalForm(new ayttm.Not(subExpression.subExpression1())), GraphFactory.negationNormalForm(new ayttm.Not(subExpression.subExpression2())));
                        case 4 /* Until */:
                            return new ayttm.Release(GraphFactory.negationNormalForm(new ayttm.Not(subExpression.subExpression1())), GraphFactory.negationNormalForm(new ayttm.Not(subExpression.subExpression2())));
                        case 5 /* Release */:
                            return new ayttm.Until(GraphFactory.negationNormalForm(new ayttm.Not(subExpression.subExpression1())), GraphFactory.negationNormalForm(new ayttm.Not(subExpression.subExpression2())));
                        case 6 /* Next */:
                            return new ayttm.Next(GraphFactory.negationNormalForm(new ayttm.Not(subExpression.subExpression1())));

                        case 1 /* Not */:
                            return GraphFactory.negationNormalForm(subExpression.subExpression1());

                        case 0 /* Proposition */:
                            return expression;
                    }
                }
            }
        };

        GraphFactory.graphNodesToString = function (nodes) {
            return nodes.map(function (node) {
                return node.toPrettyString();
            }).join(', ');
        };
        GraphFactory.loopPredicate = function (currentNode) {
            return function (otherNode) {
                return otherNode.oldExpressions.equals(currentNode.oldExpressions) && otherNode.nextExpressions.equals(currentNode.nextExpressions);
            };
        };
        return GraphFactory;
    })();
    ayttm.GraphFactory = GraphFactory;
})(ayttm || (ayttm = {}));
var ayttm;
(function (ayttm) {
    var Set = (function () {
        function Set() {
            this.map = {};
        }
        Set.prototype.add = function (value) {
            this.map[value.toString()] = value;
            return this;
        };

        Set.prototype.remove = function (value) {
            delete this.map[value.toString()];
            return this;
        };

        Set.prototype.equals = function (other) {
            for (var property in other.map) {
                if (!this.map[property]) {
                    return false;
                }
            }

            for (var property in this.map) {
                if (!other.map[property]) {
                    return false;
                }
            }
            return true;
        };

        Set.prototype.addAll = function (other) {
            for (var id in other.map) {
                this.add(other.map[id]);
            }
            return this;
        };

        Set.prototype.removeAll = function (other) {
            for (var id in other.map) {
                this.remove(other.map[id]);
            }
            return this;
        };

        Set.prototype.clear = function () {
            for (var id in this.map) {
                this.remove(this.map[id]);
            }
            return this;
        };

        Set.prototype.isEmpty = function () {
            return Object.keys(this.map).length == 0;
        };

        Set.prototype.addValueForKey = function (key, value) {
            this.map[key] = value;
            return this;
        };

        Set.prototype.clone = function () {
            var newSet = new Set();
            newSet.addAll(this);
            return newSet;
        };

        Set.prototype.item = function () {
            if (!this.isEmpty()) {
                return this.map[Object.keys(this.map)[0]];
            }
            return null;
        };

        Set.prototype.size = function () {
            return Object.keys(this.map).length;
        };

        Set.fromArray = function (array) {
            var set = new Set();
            for (var i = 0; i < array.length; ++i) {
                set.add(array[i]);
            }
            return set;
        };

        Set.singleton = function (item) {
            return new Set().add(item);
        };

        Set.empty = function () {
            return new Set();
        };

        Set.prototype.filter = function (predicate) {
            var filtered = Set.empty();
            for (var id in this.map) {
                if (predicate(this.map[id])) {
                    filtered.add(this.map[id]);
                }
            }
            return filtered;
        };

        Set.prototype.filterOne = function (predicate) {
            return this.filter(predicate).item();
        };

        Set.prototype.toArray = function () {
            var array = [];
            for (var property in this.map) {
                array.push(this.map[property]);
            }
            return array;
        };

        Set.prototype.valueForKey = function (key) {
            return this.map[key];
        };

        Set.prototype.contains = function (value) {
            return this.map[value.toString()] !== undefined;
        };

        Set.prototype.intersects = function (other) {
            for (var property in this.map) {
                if (other.map[property]) {
                    return true;
                }
            }
            return false;
        };
        return Set;
    })();
    ayttm.Set = Set;
})(ayttm || (ayttm = {}));
/// <reference path="set.ts"/>
var ayttm;
(function (ayttm) {
    var GraphNode = (function () {
        function GraphNode(name, incomingNodes, newExpressions, oldExpressions, nextExpressions) {
            this.name = name;
            this.incomingNodes = incomingNodes;
            this.newExpressions = newExpressions;
            this.oldExpressions = oldExpressions;
            this.nextExpressions = nextExpressions;
            this.final = false;
        }
        GraphNode.initialNode = function () {
            return new GraphNode(GraphNode.initialNodeName, ayttm.Set.empty(), ayttm.Set.empty(), ayttm.Set.empty(), ayttm.Set.empty());
        };

        GraphNode.newName = function () {
            GraphNode.counter = GraphNode.counter + 1;
            return "Node_" + GraphNode.counter.toString();
        };

        GraphNode.prototype.toString = function () {
            return this.name;
        };

        GraphNode.prototype.toPrettyString = function () {
            return "{ name: " + this.name + ", incoming : {" + this.incomingNodes.toArray().map(function (node) {
                return node.name;
            }).join(", ") + "}" + " }";
        };

        GraphNode.resetCounter = function () {
            GraphNode.counter = 0;
        };
        GraphNode.counter = 0;
        GraphNode.initialNodeName = 'init';
        return GraphNode;
    })();
    ayttm.GraphNode = GraphNode;
})(ayttm || (ayttm = {}));
var ayttm;
(function (ayttm) {
    var LTLEvents = (function () {
        function LTLEvents() {
        }
        LTLEvents.isDOMEvent = function (event) {
            return event.css !== undefined;
        };
        LTLEvents.TimeoutEvent = { name: 'timeout' };
        LTLEvents.TrueEvent = { name: 'true' };
        LTLEvents.FalseEvent = { name: 'false' };
        return LTLEvents;
    })();
    ayttm.LTLEvents = LTLEvents;
})(ayttm || (ayttm = {}));
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var ayttm;
(function (ayttm) {
    (function (ExpressionType) {
        ExpressionType[ExpressionType["Proposition"] = 0] = "Proposition";
        ExpressionType[ExpressionType["Not"] = 1] = "Not";
        ExpressionType[ExpressionType["And"] = 2] = "And";
        ExpressionType[ExpressionType["Or"] = 3] = "Or";
        ExpressionType[ExpressionType["Until"] = 4] = "Until";
        ExpressionType[ExpressionType["Release"] = 5] = "Release";
        ExpressionType[ExpressionType["Next"] = 6] = "Next";
    })(ayttm.ExpressionType || (ayttm.ExpressionType = {}));
    var ExpressionType = ayttm.ExpressionType;

    var Expression = (function () {
        function Expression(type) {
            this.type = type;
            Expression.counter = Expression.counter + 1;
            this.id = "Exp_" + Expression.counter.toString();
        }
        Expression.prototype.subExpression1 = function () {
            return undefined;
        };
        Expression.prototype.subExpression2 = function () {
            return undefined;
        };

        Expression.prototype.toString = function () {
            return this.id;
        };
        Expression.prototype.toPrettyString = function () {
            return this.id;
        };
        Expression.counter = 0;
        return Expression;
    })();
    ayttm.Expression = Expression;

    var UnaryExpression = (function (_super) {
        __extends(UnaryExpression, _super);
        function UnaryExpression(exp, type) {
            _super.call(this, type);
            this.exp = exp;
            this.type = type;
        }
        UnaryExpression.prototype.subExpression1 = function () {
            return this.exp;
        };

        UnaryExpression.prototype.toPrettyString = function () {
            return ExpressionType[this.type] + " (" + this.subExpression1().toPrettyString() + ")";
        };
        return UnaryExpression;
    })(Expression);
    ayttm.UnaryExpression = UnaryExpression;

    var BinaryExpression = (function (_super) {
        __extends(BinaryExpression, _super);
        function BinaryExpression(exp1, exp2, type) {
            _super.call(this, type);
            this.exp1 = exp1;
            this.exp2 = exp2;
            this.type = type;
        }
        BinaryExpression.prototype.subExpression1 = function () {
            return this.exp1;
        };
        BinaryExpression.prototype.subExpression2 = function () {
            return this.exp2;
        };

        BinaryExpression.prototype.toPrettyString = function () {
            return "(" + this.subExpression1().toPrettyString() + " " + ExpressionType[this.type] + " " + this.subExpression2().toPrettyString() + ")";
        };
        return BinaryExpression;
    })(Expression);
    ayttm.BinaryExpression = BinaryExpression;

    var Proposition = (function (_super) {
        __extends(Proposition, _super);
        function Proposition(event) {
            _super.call(this, 0 /* Proposition */);
            this.event = event;
        }
        Proposition.prototype.matches = function (message) {
            return ayttm.LTLEvents.TrueEvent.name === this.event.name || ((message.name === this.event.name && (!(ayttm.LTLEvents.isDOMEvent(message) && this.isDOMEvent()) || message.css === this.event.css)) && (!this.hasFilter() || this.event.filter(message)));
        };

        Proposition.prototype.toPrettyString = function () {
            return this.event.name + (this.event.css ? ':' + this.event.css : '') + (this.hasTrigger() ? ':Trigger' : '');
        };

        Proposition.prototype.hasTrigger = function () {
            return this.event.trigger != undefined;
        };

        Proposition.prototype.hasFilter = function () {
            return this.event.filter != undefined;
        };

        Proposition.prototype.applyTrigger = function (message) {
            if (this.hasTrigger()) {
                this.event.trigger(message);
            }
        };

        Proposition.prototype.isDOMEvent = function () {
            return this.event.css != undefined;
        };
        return Proposition;
    })(Expression);
    ayttm.Proposition = Proposition;

    /**
    *  this.trigger depends on UIDocumentService.
    *  i.e. this.trigger = this.symbolicTrigger.callback(someDocumentService);
    */
    var PropositionWithSymbolicTrigger = (function (_super) {
        __extends(PropositionWithSymbolicTrigger, _super);
        function PropositionWithSymbolicTrigger(event, symbolicTrigger) {
            _super.call(this, event);
            this.event = event;
            this.symbolicTrigger = symbolicTrigger;
        }
        return PropositionWithSymbolicTrigger;
    })(Proposition);
    ayttm.PropositionWithSymbolicTrigger = PropositionWithSymbolicTrigger;

    var Not = (function (_super) {
        __extends(Not, _super);
        function Not(exp) {
            _super.call(this, exp, 1 /* Not */);
            this.exp = exp;
        }
        return Not;
    })(UnaryExpression);
    ayttm.Not = Not;

    var Next = (function (_super) {
        __extends(Next, _super);
        function Next(exp) {
            _super.call(this, exp, 6 /* Next */);
            this.exp = exp;
        }
        return Next;
    })(UnaryExpression);
    ayttm.Next = Next;

    var And = (function (_super) {
        __extends(And, _super);
        function And(exp1, exp2) {
            _super.call(this, exp1, exp2, 2 /* And */);
            this.exp1 = exp1;
            this.exp2 = exp2;
        }
        return And;
    })(BinaryExpression);
    ayttm.And = And;

    var Or = (function (_super) {
        __extends(Or, _super);
        function Or(exp1, exp2) {
            _super.call(this, exp1, exp2, 3 /* Or */);
            this.exp1 = exp1;
            this.exp2 = exp2;
        }
        return Or;
    })(BinaryExpression);
    ayttm.Or = Or;

    var Until = (function (_super) {
        __extends(Until, _super);
        function Until(exp1, exp2) {
            _super.call(this, exp1, exp2, 4 /* Until */);
            this.exp1 = exp1;
            this.exp2 = exp2;
        }
        return Until;
    })(BinaryExpression);
    ayttm.Until = Until;

    var Release = (function (_super) {
        __extends(Release, _super);
        function Release(exp1, exp2) {
            _super.call(this, exp1, exp2, 5 /* Release */);
            this.exp1 = exp1;
            this.exp2 = exp2;
        }
        return Release;
    })(BinaryExpression);
    ayttm.Release = Release;

    ayttm.True = new Proposition(ayttm.LTLEvents.TrueEvent);
    ayttm.False = new Proposition(ayttm.LTLEvents.FalseEvent);
    ayttm.Timeout = new Proposition(ayttm.LTLEvents.TimeoutEvent);

    function checkForRestrictionsOnTriggers(e) {
        switch (e.type) {
            case 6 /* Next */:
                return checkForRestrictionsOnTriggers(e.subExpression1());
                break;
            case 1 /* Not */:
                var subExpression = e.subExpression1();
                switch (subExpression.type) {
                    case 0 /* Proposition */:
                        return !subExpression.hasTrigger();
                }
                return checkForRestrictionsOnTriggers(subExpression);
            case 0 /* Proposition */:
                return true;
            case 3 /* Or */:
            case 2 /* And */:
                return checkForRestrictionsOnTriggers(e.subExpression1()) && checkForRestrictionsOnTriggers(e.subExpression2());
            case 4 /* Until */:
            case 5 /* Release */:
                return (!hasTriggers(e.subExpression1()) && checkForRestrictionsOnTriggers(e.subExpression2())) || (!hasTriggers(e.subExpression2()) && checkForRestrictionsOnTriggers(e.subExpression1()));
        }
    }
    ayttm.checkForRestrictionsOnTriggers = checkForRestrictionsOnTriggers;

    function hasTriggers(e) {
        switch (e.type) {
            case 6 /* Next */:
            case 1 /* Not */:
                return hasTriggers(e.subExpression1());
            case 0 /* Proposition */:
                return e.hasTrigger();
            case 3 /* Or */:
            case 4 /* Until */:
            case 2 /* And */:
            case 5 /* Release */:
                return hasTriggers(e.subExpression1()) || hasTriggers(e.subExpression2());
        }
    }
})(ayttm || (ayttm = {}));
var ayttm;
(function (ayttm) {
    (function (LogLevel) {
        LogLevel[LogLevel["vortex"] = 0] = "vortex";
        LogLevel[LogLevel["debug"] = 1] = "debug";
        LogLevel[LogLevel["info"] = 2] = "info";
        LogLevel[LogLevel["error"] = 3] = "error";
    })(ayttm.LogLevel || (ayttm.LogLevel = {}));
    var LogLevel = ayttm.LogLevel;

    var Logger = (function () {
        function Logger() {
        }
        Logger.logStringAtLevel = function (s, l) {
            if (l <= Logger.level) {
                if (typeof s.toPrettyString === "function") {
                    console.log(s.toPrettyString());
                } else {
                    console.log(s.toString());
                }
            }
        };

        Logger.debug = function (s) {
            Logger.logStringAtLevel(s, 1 /* debug */);
        };

        Logger.info = function (s) {
            Logger.logStringAtLevel(s, 2 /* info */);
        };

        Logger.error = function (s) {
            Logger.logStringAtLevel(s, 3 /* error */);
        };
        Logger.level = 0 /* vortex */;
        return Logger;
    })();
    ayttm.Logger = Logger;
})(ayttm || (ayttm = {}));
var ayttm;
(function (ayttm) {
    var Map = (function () {
        function Map() {
            this.map = {};
        }
        Map.prototype.put = function (key, value) {
            this.map[key.toString()] = value;
            return this;
        };

        Map.prototype.remove = function (key) {
            delete this.map[key.toString()];
            return this;
        };

        Map.prototype.addValueForKey = function (key, value) {
            this.map[key.toString()] = value;
            return this;
        };

        Map.prototype.valueForKey = function (key) {
            return this.map[key];
        };

        Map.prototype.contains = function (key) {
            return this.map[key.toString()] !== undefined;
        };
        return Map;
    })();
    ayttm.Map = Map;
})(ayttm || (ayttm = {}));
var ayttm;
(function (ayttm) {
    var StartTimer = (function () {
        function StartTimer(milliseconds) {
            this.milliseconds = milliseconds;
        }
        StartTimer.prototype.callbackFromDocumentService = function (documentService) {
            var _this = this;
            return function (event) {
                documentService.startTimer(_this.milliseconds);
            };
        };
        return StartTimer;
    })();
    ayttm.StartTimer = StartTimer;

    var AddClass = (function () {
        function AddClass(cssSelector, cssClass) {
            this.cssSelector = cssSelector;
            this.cssClass = cssClass;
        }
        AddClass.prototype.callbackFromDocumentService = function (documentService) {
            var _this = this;
            return function (event) {
                documentService.addClass(_this.cssSelector, _this.cssClass);
            };
        };
        return AddClass;
    })();
    ayttm.AddClass = AddClass;

    var RemoveClass = (function () {
        function RemoveClass(cssSelector, cssClass) {
            this.cssSelector = cssSelector;
            this.cssClass = cssClass;
        }
        RemoveClass.prototype.callbackFromDocumentService = function (documentService) {
            var _this = this;
            return function (event) {
                documentService.removeClass(_this.cssSelector, _this.cssClass);
            };
        };
        return RemoveClass;
    })();
    ayttm.RemoveClass = RemoveClass;

    var ToggleClass = (function () {
        function ToggleClass(cssSelector, cssClass) {
            this.cssSelector = cssSelector;
            this.cssClass = cssClass;
        }
        ToggleClass.prototype.callbackFromDocumentService = function (documentService) {
            var _this = this;
            return function (event) {
                documentService.toggleClass(_this.cssSelector, _this.cssClass);
            };
        };
        return ToggleClass;
    })();
    ayttm.ToggleClass = ToggleClass;

    var TrackMouseMovement = (function () {
        function TrackMouseMovement(cssSelector, containerSelector) {
            this.cssSelector = cssSelector;
            this.containerSelector = containerSelector;
        }
        TrackMouseMovement.prototype.callbackFromDocumentService = function (documentService) {
            var _this = this;
            return function (event) {
                documentService.trackMouseMovement(_this.cssSelector, _this.containerSelector, event);
            };
        };
        return TrackMouseMovement;
    })();
    ayttm.TrackMouseMovement = TrackMouseMovement;
})(ayttm || (ayttm = {}));
var ayttm;
(function (ayttm) {
    var BasicUIDocumentService = (function () {
        function BasicUIDocumentService(eventListener) {
            this.eventListener = eventListener;
        }
        BasicUIDocumentService.prototype.startTimer = function (milliseconds) {
            var _this = this;
            this.clearTimeout();
            this.timeoutId = setTimeout(function () {
                _this.eventListener.accept(ayttm.LTLEvents.TimeoutEvent);
            }, milliseconds);
            ayttm.Logger.debug("Started timeout " + this.timeoutId);
        };

        BasicUIDocumentService.prototype.clearTimeout = function () {
            if (this.timeoutId != undefined) {
                ayttm.Logger.debug("Clearing timeout " + this.timeoutId);
                clearTimeout(this.timeoutId);
                this.timeoutId = undefined;
            }
        };

        BasicUIDocumentService.prototype.applyToQueryResult = function (cssSelector, f) {
            var items = document.querySelectorAll(cssSelector);
            for (var i = 0; i < items.length; ++i) {
                f(items.item(i));
            }
        };

        BasicUIDocumentService.prototype.addListenerToDocumentElements = function (cssSelector, eventName) {
            var _this = this;
            this.applyToQueryResult(cssSelector, function (element) {
                element.addEventListener(eventName, function (event) {
                    _this.eventListener.accept({ name: eventName, css: cssSelector, source: event });
                });
            });
        };

        BasicUIDocumentService.prototype.addClass = function (cssSelector, cssClass) {
            this.applyToQueryResult(cssSelector, function (element) {
                if (!element.classList.contains(cssClass)) {
                    element.classList.add(cssClass);
                    ayttm.Logger.debug("Added " + cssClass + " on " + cssSelector);
                } else {
                    ayttm.Logger.debug(cssSelector + " already has " + cssClass);
                }
            });
        };

        BasicUIDocumentService.prototype.removeClass = function (cssSelector, cssClass) {
            this.applyToQueryResult(cssSelector, function (element) {
                element.classList.remove(cssClass);
                ayttm.Logger.debug("Removed " + cssClass + " on " + cssSelector);
            });
        };

        BasicUIDocumentService.prototype.toggleClass = function (cssSelector, cssClass) {
            this.applyToQueryResult(cssSelector, function (element) {
                element.classList.toggle(cssClass);
            });
        };

        BasicUIDocumentService.prototype.show = function (cssSelector) {
            this.css(cssSelector, 'display', 'block');
        };

        BasicUIDocumentService.prototype.hide = function (cssSelector) {
            this.css(cssSelector, 'display', 'none');
        };

        BasicUIDocumentService.prototype.css = function (cssSelector, property, value) {
            this.applyToQueryResult(cssSelector, function (element) {
                element.style[property] = value;
            });
        };

        BasicUIDocumentService.prototype.trackMouseMovement = function (cssSelector, containerSelector, event) {
            var _this = this;
            var container = document.querySelector(containerSelector);
            var cr = container.getBoundingClientRect();
            this.applyToQueryResult(cssSelector, function (element) {
                var top = _this.numberFromPixels(element.style.top ? element.style.top : element.offsetTop);
                var left = _this.numberFromPixels(element.style.left ? element.style.left : element.offsetLeft);
                var width = _this.numberFromPixels(element.style.width ? element.style.width : element.offsetWidth);
                var height = _this.numberFromPixels(element.style.height ? element.style.height : element.offsetHeight);
                element.style.top = Math.min(cr.top + cr.height - height, Math.max(cr.top, (top + (event.source.clientY - event.otherPreviousEvent.clientY)))) + 'px';
                element.style.left = Math.min(cr.left + cr.width - width, Math.max(cr.left, (left + (event.source.clientX - event.otherPreviousEvent.clientX)))) + 'px';
            });
        };

        BasicUIDocumentService.prototype.numberFromPixels = function (v) {
            if (typeof v === 'number') {
                return v;
            }
            if (typeof v === 'string') {
                return parseInt(v.replace('px', ''));
            }
        };
        return BasicUIDocumentService;
    })();
    ayttm.BasicUIDocumentService = BasicUIDocumentService;
})(ayttm || (ayttm = {}));
