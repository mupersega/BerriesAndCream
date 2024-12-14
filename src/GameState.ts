// Add this method to your GameState class
public drawEntities(ctx: CanvasRenderingContext2D): void {
    // Combine agents and resources into a single array of drawables
    const drawables: Drawable[] = [
        ...this.agents,
        ...this.resources
    ];

    // Sort by isometric depth (objects further back should be drawn first)
    drawables.sort((a, b) => {
        const posA = a.getPosition();
        const posB = b.getPosition();
        // In isometric view, objects with larger x+y should be drawn first
        return (posB.x + posB.y) - (posA.x + posA.y);
    });

    // Draw all entities in sorted order
    for (const entity of drawables) {
        const pos = entity.getPosition();
        const screenPos = this.mapToScreen(pos.x, pos.y);
        entity.draw(ctx, screenPos.x, screenPos.y);
    }
} 