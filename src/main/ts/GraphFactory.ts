module ayttm {

    export class GraphFactory {

        private static loopPredicate = (currentNode : GraphNode) => {
            return (otherNode: GraphNode) => {
                return otherNode.oldExpressions.equals(currentNode.oldExpressions) &&
                       otherNode.nextExpressions.equals(currentNode.nextExpressions);
            };
        };

        private static expand(node : GraphNode, nodesSet : Set<GraphNode>) : Set<GraphNode> {

            if (node.newExpressions.isEmpty()) {

                var otherNode = nodesSet.filterOne(GraphFactory.loopPredicate(node));
                if (otherNode != null) {
                    otherNode.incomingNodes.addAll(node.incomingNodes);
                    return nodesSet;
                }

                var newName = GraphNode.newName();
                return GraphFactory.expand(new GraphNode(
                        newName,
                        Set.singleton<GraphNode>(node),
                        node.nextExpressions.clone(),
                        Set.empty<Expression>(),
                        Set.empty<Expression>()
                    ),
                    new Set<GraphNode>().addAll(nodesSet).add(node)
                );
            } else {
                var eta = node.newExpressions.item();
                node.newExpressions.remove(eta);

                if (eta.type == ExpressionType.Proposition ||
                   (eta.type == ExpressionType.Not &&
                    eta.subExpression1().type == ExpressionType.Proposition)
                 ){
                    if (eta === False) {
                        return nodesSet;
                    }
                    node.oldExpressions = new Set<Expression>().addAll(node.oldExpressions).add(eta);
                    return GraphFactory.expand(node, nodesSet);
                } else {
                    switch(eta.type) {
                        case ExpressionType.Until :
                        case ExpressionType.Release :
                        case ExpressionType.Or:
                            var node1 = new GraphNode (
                                GraphNode.newName(),
                                node.incomingNodes.clone(),
                                node.newExpressions.clone().addAll(GraphFactory.new1(eta).removeAll(node.oldExpressions)),
                                node.oldExpressions.clone().add(eta),
                                node.nextExpressions.clone().addAll(GraphFactory.next1(eta))
                            );
                            var node2 = new GraphNode (
                                GraphNode.newName(),
                                node.incomingNodes.clone(),
                                node.newExpressions.clone().addAll(GraphFactory.new2(eta).removeAll(node.oldExpressions)),
                                node.oldExpressions.clone().add(eta),
                                node.nextExpressions.clone()
                            );
                            return GraphFactory.expand(node2, GraphFactory.expand(node1, nodesSet));

                        case ExpressionType.And:
                            return GraphFactory.expand(new GraphNode(
                                    node.name,
                                    node.incomingNodes.clone(),
                                    node.newExpressions.clone().addAll(Set.fromArray<Expression>([eta.subExpression1(), eta.subExpression2()]).removeAll(node.oldExpressions)),
                                    node.oldExpressions.clone().add(eta),
                                    node.nextExpressions
                                ),
                                nodesSet
                            );
                        case ExpressionType.Next:
                            return GraphFactory.expand(new GraphNode(
                                node.name,
                                node.incomingNodes.clone(),
                                node.newExpressions.clone(),
                                node.oldExpressions.clone().add(eta),
                                node.nextExpressions.clone().add(eta.subExpression1())
                            ),
                            nodesSet
                            );
                    }
                }
            }
        }

        public static createGraph(expression : Expression) : Set<GraphNode> {
            GraphNode.resetCounter();
            var initialNode = GraphNode.initialNode();
            var nodes = GraphFactory.expand(new GraphNode(
                GraphNode.newName(),
                Set.singleton<GraphNode>(initialNode),
                Set.singleton<Expression>(GraphFactory.negationNormalForm(expression)),
                Set.empty<Expression>(),
                Set.empty<Expression>()
            ), Set.empty<GraphNode>());

            nodes.add(initialNode);
            return nodes;
        }

        public static next1(expression : Expression) : Set<Expression> {
            switch (expression.type) {
                case ExpressionType.Until : return new Set<Expression>().add(expression);
                case ExpressionType.Release : return new Set<Expression>().add(expression);
                case ExpressionType.Or : return new Set<Expression>();
                default : return undefined;
            }
        }

        public static new1(expression : Expression) : Set<Expression> {
            switch (expression.type) {
                case ExpressionType.Until : return new Set<Expression>().add(expression.subExpression1());
                case ExpressionType.Release : return new Set<Expression>().add(expression.subExpression2());
                case ExpressionType.Or : return new Set<Expression>().add(expression.subExpression1());
                default : return undefined;
            }
        }

        public static new2(expression : Expression) : Set<Expression> {
            switch (expression.type) {
                case ExpressionType.Until : return new Set<Expression>().add(expression.subExpression2());
                case ExpressionType.Release : return new Set<Expression>().add(expression.subExpression1()).add(expression.subExpression2());
                case ExpressionType.Or : return new Set<Expression>().add(expression.subExpression2());
                default : return undefined;
            }
        }

        public static negationNormalForm(expression : Expression) {
            switch (expression.type) {

                case ExpressionType.Proposition : return expression;

                case ExpressionType.Or:
                    return new Or(GraphFactory.negationNormalForm(expression.subExpression1()),
                                   GraphFactory.negationNormalForm(expression.subExpression2()));
                case ExpressionType.And:
                    return new And(GraphFactory.negationNormalForm(expression.subExpression1()),
                                   GraphFactory.negationNormalForm(expression.subExpression2()));
                case ExpressionType.Until:
                    return new Until(GraphFactory.negationNormalForm(expression.subExpression1()),
                                     GraphFactory.negationNormalForm(expression.subExpression2()));
                case ExpressionType.Release:
                    return new Release(GraphFactory.negationNormalForm(expression.subExpression1()),
                                       GraphFactory.negationNormalForm(expression.subExpression2()));
                case ExpressionType.Next:
                    return new Next(GraphFactory.negationNormalForm(expression.subExpression1()));

                case ExpressionType.Not : {

                    var subExpression = expression.subExpression1();

                    switch(subExpression.type) {
                        case ExpressionType.Or:
                            return new And(GraphFactory.negationNormalForm(new Not(subExpression.subExpression1())),
                                           GraphFactory.negationNormalForm(new Not(subExpression.subExpression2())));
                        case ExpressionType.And:
                            return new Or(GraphFactory.negationNormalForm(new Not(subExpression.subExpression1())),
                                          GraphFactory.negationNormalForm(new Not(subExpression.subExpression2())));
                        case ExpressionType.Until:
                            return new Release(GraphFactory.negationNormalForm(new Not(subExpression.subExpression1())),
                                               GraphFactory.negationNormalForm(new Not(subExpression.subExpression2())));
                        case ExpressionType.Release:
                            return new Until(GraphFactory.negationNormalForm(new Not(subExpression.subExpression1())),
                                             GraphFactory.negationNormalForm(new Not(subExpression.subExpression2())));
                        case ExpressionType.Next:
                            return new Next(GraphFactory.negationNormalForm(new Not(subExpression.subExpression1())));

                        case ExpressionType.Not:
                            return GraphFactory.negationNormalForm(subExpression.subExpression1());

                        case ExpressionType.Proposition : return expression;
                    }
                }
            }
        }

        public static graphNodesToString(nodes : Array<GraphNode>) {
            return nodes.map((node: GraphNode) => {return node.toPrettyString();}).join(', ');
        }
    }
}
