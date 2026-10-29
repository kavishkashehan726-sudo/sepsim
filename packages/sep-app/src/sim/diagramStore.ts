import { ACCUMULATOR_DIAGRAM, type Diagram, reviveDiagram } from "./diagram";
import { Store } from "./store";

/** The diagram shown in the schematic pane; remembered between sessions. */
export const diagramStore = new Store<Diagram>(ACCUMULATOR_DIAGRAM, "sepsim.diagram", reviveDiagram);
