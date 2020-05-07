import { AbstractUpdater } from "./AbstractUpdater";
import { CWire } from "./CWire";
import { ECS, Entity } from "./ECS";

export class SWireManager extends AbstractUpdater {
  constructor(readonly ecs: ECS) {
    super();
  }

  dummyDragTargets = new Set<Entity>();

  update() {
    for (const [grabbedEntity, grabTarget] of this.ecs.pointerGrabTargets) {
      if (grabTarget.grabbed && this.ecs.ports.has(grabbedEntity)) {
        // create a draggable wire from a port or delete an existing one
        this.deleteWireIfExists(grabbedEntity, grabTarget.grabbed.pointer) ||
          this.createDraggableWire(grabbedEntity, grabTarget.grabbed.pointer);
        delete grabTarget.grabbed;
      } else if (
        !grabTarget.grabbed &&
        this.dummyDragTargets.has(grabbedEntity)
      ) {
        // delete a dummy grab target created to cancel a drag
        this.ecs.pointerGrabTargets.delete(grabbedEntity);
        this.dummyDragTargets.delete(grabbedEntity);
      } else if (!grabTarget.grabbed && this.ecs.wires.has(grabbedEntity)) {
        // connect a wire if dropped on a compatible port
        this.dropWire(grabbedEntity);
      }
    }
  }

  deleteWireIfExists(grabbedEntity: Entity, pointer: Entity) {
    for (const [wireEntity, wire] of this.ecs.wires) {
      if (wire.source === grabbedEntity || wire.destination === grabbedEntity) {
        this.disconnect(wire);
        this.ecs.wires.delete(wireEntity);
        const dummy = this.ecs.createEntity(
          "dummy-" + grabbedEntity.description
        );
        this.dummyDragTargets.add(dummy);
        this.ecs.pointerGrabTargets.set(dummy, {
          grabbed: {
            pointer: pointer,
            dx: 0,
            dy: 0,
          },
        });
        return true;
      }
    }
    return false;
  }

  createDraggableWire(grabbedEntity: Entity, pointer: Entity) {
    const wire = this.ecs.createEntity("wire");
    this.ecs.wires.set(wire, {
      source: grabbedEntity,
      destination: pointer,
    });
    this.ecs.pointerGrabTargets.set(wire, {
      grabbed: {
        pointer: pointer,
        dx: 0,
        dy: 0,
      },
    });
  }

  dropWire(grabbedEntity: Entity) {
    const wire = this.ecs.wires.get(grabbedEntity)!;
    const transform = this.ecs.transforms.get(wire.destination)!;
    const target = this.ecs.mouseInput.findTargetEntity(transform);
    let connected = false;
    if (target && this.ecs.ports.has(target)) {
      wire.destination = target;
      connected = this.connect(wire);
    }
    if (!connected) {
      this.ecs.wires.delete(grabbedEntity);
    }
    this.ecs.pointerGrabTargets.delete(grabbedEntity);
  }

  connect(wire: CWire, connect = true) {
    let sourcePort = this.ecs.ports.get(wire.source);
    let destinationPort = this.ecs.ports.get(wire.destination);

    if (!sourcePort || !destinationPort) {
      return false;
    }

    if (sourcePort.output === undefined) {
      const tmp = sourcePort;
      sourcePort = destinationPort;
      destinationPort = tmp;
    }

    if (
      sourcePort.output === undefined ||
      destinationPort.input === undefined
    ) {
      return false;
    }

    sourcePort.node[connect ? "connect" : "disconnect"](
      destinationPort.node,
      sourcePort.output,
      destinationPort.input
    );

    return true;
  }

  disconnect(wire: CWire) {
    this.connect(wire, false);
  }
}
