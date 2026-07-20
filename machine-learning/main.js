import { buildLayout } from "./layout";

function getClosestDuck(stage) {
    const aliveDucks = stage.ducks.filter((duck) => duck.alive);
    if (aliveDucks.length === 0) {
        return null;
    }

    const origin = stage.aim && stage.aim.visible ? stage.aim.position : { x: 400, y: 300 };
    let best = null;
    let bestDistance = Infinity;

    aliveDucks.forEach((duck) => {
        const dx = duck.position.x - origin.x;
        const dy = duck.position.y - origin.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = duck;
        }
    });

    return best;
}

export default async function main(game) {
    const container = buildLayout(game.app);
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

    game.stage.aim.visible = false;

    worker.onmessage = ({ data }) => {
        const { type, x, y } = data;

        if (type === 'prediction') {
            console.log(`🎯 AI predicted at: (${x}, ${y})`);
            container.updateHUD(data);
            game.stage.aim.visible = true;

            const stageScaleX = game.stage.scale.x || 1;
            const stageScaleY = game.stage.scale.y || 1;
            const localX = x / stageScaleX;
            const localY = y / stageScaleY;

            game.stage.aim.setPosition(localX, localY);
            const position = game.stage.aim.getGlobalPosition();

            if (game.stage.isPointNearAliveDuck(position, game.level.radius)) {
                game.handleClick({
                    global: position,
                });
                return;
            }

            const fallbackDuck = getClosestDuck(game.stage);
            if (fallbackDuck) {
                game.stage.aim.setPosition(fallbackDuck.position.x, fallbackDuck.position.y);
                const fallbackPosition = game.stage.aim.getGlobalPosition();
                console.log('🎯 Fallback shooting live duck at:', fallbackDuck.position.x, fallbackDuck.position.y);
                game.handleClick({
                    global: fallbackPosition,
                });
                return;
            }

            console.log('🚫 AI prediction did not match any live duck, and no fallback target was available');
        }

    };

    setInterval(async () => {
        const canvas = game.app.renderer.extract.canvas(game.stage);
        const bitmap = await createImageBitmap(canvas);

        worker.postMessage({
            type: 'predict',
            image: bitmap,
        }, [bitmap]);

    }, 200); // every 200ms

    return container;
}
