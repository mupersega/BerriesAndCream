import { IDrawable } from '../interfaces/IDrawable';
import { IsometricRenderer } from './IsometricRenderer';

export class RenderSystem {
  private static sortDrawables(drawables: IDrawable[]): IDrawable[] {
    return drawables.sort((a, b) => {
      const orderA = a.getDrawOrder?.() ?? (a.getPosition().x + a.getPosition().y);
      const orderB = b.getDrawOrder?.() ?? (b.getPosition().x + b.getPosition().y);
      return orderA - orderB;
    });
  }

  public static render(
    ctx: CanvasRenderingContext2D,
    drawables: IDrawable[]
  ): void {
    const sorted = this.sortDrawables(drawables);
    
    sorted.forEach(drawable => {
      const worldPos = drawable.getPosition();
      const screenPos = IsometricRenderer.worldToScreen(worldPos.x, worldPos.y);
      drawable.draw(ctx, screenPos.x, screenPos.y);
    });
  }
}
