/**
 * Singleton pattern implementation
 *
 * In TypeScript, we use a simpler approach than Python's metaclasses.
 * This provides a mixin that can be used to create singleton classes.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = object> = new (...args: any[]) => T;

const instances = new WeakMap<Constructor, object>();

export function Singleton<T extends Constructor>(Base: T): T {
  return class extends Base {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      if (instances.has(Base)) {
        // eslint-disable-next-line constructor-super
        return instances.get(Base) as InstanceType<T>;
      }
      super(...args);
      instances.set(Base, this);
    }

    static resetInstance(): void {
      instances.delete(Base);
    }
  } as T;
}

/**
 * Alternative: Simple module-level singleton pattern
 * For classes that don't need to be dynamically created
 */
export class SingletonBase {
  private static instances = new Map<string, SingletonBase>();

  protected constructor() {
    const className = this.constructor.name;
    if (SingletonBase.instances.has(className)) {
      return SingletonBase.instances.get(className)!;
    }
    SingletonBase.instances.set(className, this);
  }

  static resetInstance(): void {
    const className = this.name;
    SingletonBase.instances.delete(className);
  }
}
