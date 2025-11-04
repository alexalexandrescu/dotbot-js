/**
 * Logging messenger (singleton)
 */

import { Color } from "./color.ts";
import { Level } from "./level.ts";
import { SingletonBase } from "../util/singleton.ts";

export class Messenger extends SingletonBase {
  private _level: Level;
  private _useColor: boolean;

  constructor(level: Level = Level.ACTION) {
    super();
    this._level = level;
    this._useColor = true;
  }

  setLevel(level: Level): void {
    this._level = level;
  }

  useColor(yesno: boolean): void {
    this._useColor = yesno;
  }

  log(level: Level, message: string): void {
    if (level >= this._level) {
      console.log(`${this._color(level)}${message}${this._reset()}`);
    }
  }

  debug(message: string): void {
    this.log(Level.DEBUG, message);
  }

  action(message: string): void {
    this.log(Level.ACTION, message);
  }

  info(message: string): void {
    this.log(Level.INFO, message);
  }

  /**
   * @deprecated Use info() or action() instead
   */
  lowinfo(message: string): void {
    this.info(message);
  }

  warning(message: string): void {
    this.log(Level.WARNING, message);
  }

  error(message: string): void {
    this.log(Level.ERROR, message);
  }

  private _color(level: Level): string {
    if (!this._useColor || level < Level.DEBUG) {
      return "";
    }
    if (level < Level.INFO) {
      return Color.YELLOW;
    }
    if (level < Level.ACTION) {
      return Color.BLUE;
    }
    if (level < Level.WARNING) {
      return Color.GREEN;
    }
    if (level < Level.ERROR) {
      return Color.MAGENTA;
    }
    return Color.RED;
  }

  private _reset(): string {
    if (!this._useColor) {
      return "";
    }
    return Color.RESET;
  }
}
