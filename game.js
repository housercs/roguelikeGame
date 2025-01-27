const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameOverDiv = document.getElementById('gameOver');

// 设置画布大小
canvas.width = 800;
canvas.height = 600;

// 在文件顶部添加一个记录游戏开始时间的变量
const gameStartTime = Date.now();

// 在全局定义一个 spawnTimer 以存放 setInterval 返回的定时器ID
let spawnTimer = null;

/**
 * 在游戏开始时或玩家等级变化后，
 * 根据玩家当前等级，计算新的怪物生成间隔，然后重置定时器。
 */
function updateMonsterSpawnInterval() {
    // 以 1000ms 作为基准，随着等级升高而缩短
    // 比如：实际间隔 = max(1000 / player.level, 200)
    // 确保最小间隔不低于200ms，避免极端情况过快或除数为零
    const newInterval = Math.max(1000 / player.level, 200);

    // 如果之前有定时器，先清除
    if (spawnTimer) {
        clearInterval(spawnTimer);
    }

    // 重新设定怪物生成定时器
    spawnTimer = setInterval(() => {
        if (gameActive) {
            monsters.push(new Monster());
        }
    }, newInterval);
}

// 玩家类
class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.radius = 15;  // 增大人物半径
        this.speed = 1; // 使人物移动速度只比敌人稍快
        this.health = 10;
        this.angle = 0;
        this.gunOffset = 20; // 双枪之间的距离
        this.targetAngle = 0; // 目标角度
        this.rotationSpeed = 0.1; // 旋转速度
        this.level = 1;  // 初始等级
        this.exp = 0;    // 当前经验值
        this.expToNextLevel = 100;  // 升级所需经验值

        ////////////////////////////////////////////////
        // 新增属性：攻击力、防御力
        this.attack = 1;
        this.defense = 0;  // 可以理解为减伤比例(0~1)，也可使用别的逻辑
        ////////////////////////////////////////////////

        //////////////////////////////////////////////////////////////////////
        // 新增用于"动画显示"的属性
        this.displayExp = 0;       // 显示中的经验值 (逐帧逼近 this.exp)
        this.displayHealth = this.health; // 显示中的血量 (逐帧逼近 this.health)
        this.expAnimationSpeed = 3;       // 控制经验条动画速度 (可自行调整)
        this.healthAnimationSpeed = 3;    // 控制血量动画速度 (可自行调整)
        //////////////////////////////////////////////////////////////////////
    }

    findNearestMonster() {
        if (monsters.length === 0) return null;
        
        let nearestMonster = monsters[0];
        let minDistance = Infinity;
        
        for (let monster of monsters) {
            const dx = monster.x - this.x;
            const dy = monster.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestMonster = monster;
            }
        }
        
        return nearestMonster;
    }

    // 添加获取经验值的方法
    gainExp(amount) {
        this.exp += amount; 
        // 不在这里直接 levelUp
        // 而是等动画走完后再说
    }

    // 添加升级方法
    levelUp() {
        this.level++;
        this.exp -= this.expToNextLevel;
        this.expToNextLevel *= 2;
        this.health = 10 + this.level * 2;
        this.speed += 0.2;

        pauseGame(); 
        openUpgradeModal();
        updateMonsterSpawnInterval(); 
    }

    draw() {
        ctx.save();
        ctx.translate(canvas.width/2, canvas.height/2);
        ctx.rotate(this.angle);
        
        // 绘制玩家身体
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'blue';
        ctx.fill();
        
        ////////////////////////////////////////////////
        // 将枪管放在玩家的中心位置（左右居中）
        ctx.beginPath();
        // 让枪管的中心对准 (0,0)，宽度40，高度8
        // 这里 x = -20 ～ x = 20，y = -4 ～ y = 4
        ctx.rect(-20, -4, 40, 8);
        ctx.fillStyle = 'gray';
        ctx.fill();
        ////////////////////////////////////////////////
        
        ctx.restore();

        ///////////////////////////////////////////////////
        // 绘制血条: 使用 displayHealth
        ///////////////////////////////////////////////////
        ctx.fillStyle = 'red';
        ctx.fillRect(10, 10, this.displayHealth * 10, 10);

        // 绘制经验条背景
        ctx.fillStyle = '#444';
        ctx.fillRect(10, 25, 100, 5);

        // 计算 displayExp 在 expToNextLevel 中所占百分比
        const expRate = this.displayExp / this.expToNextLevel;
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(10, 25, expRate * 100, 5);

        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(`Level ${this.level}`, 120, 35);
    }

    update() {
        const prevX = this.x;
        const prevY = this.y;

        // 键盘控制移动
        if (keys.ArrowUp) this.y -= this.speed;
        if (keys.ArrowDown) this.y += this.speed;
        if (keys.ArrowLeft) this.x -= this.speed;
        if (keys.ArrowRight) this.x += this.speed;

        // 更新相机位置
        camera.x = this.x - canvas.width / 2;
        camera.y = this.y - canvas.height / 2;

        // 自动瞄准最近的敌人
        const nearestMonster = this.findNearestMonster();
        if (nearestMonster) {
            // 计算目标角度
            this.targetAngle = Math.atan2(
                nearestMonster.y - this.y,
                nearestMonster.x - this.x
            );

            // 平滑旋转到目标角度
            let angleDiff = this.targetAngle - this.angle;
            
            // 确保角度差在 -PI 到 PI 之间
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            // 平滑旋转
            this.angle += angleDiff * this.rotationSpeed;
        }

        // 让显示用血量逐帧逼近真实血量
        let healthDiff = this.health - this.displayHealth;
        if (Math.abs(healthDiff) > 0.01) {
            const step = Math.sign(healthDiff) * this.healthAnimationSpeed;
            // 若 step 大于差值，就只走差值大小，避免"过冲"
            if (Math.abs(step) > Math.abs(healthDiff)) {
                this.displayHealth = this.health;
            } else {
                this.displayHealth += step;
            }
        }
        // 如果动画显示血量已经 <= 0，才真正执行游戏结束
        // （使得血条先可视化地扣完）
        if (this.displayHealth <= 0) {
            gameActive = false;
            gameOverDiv.style.display = 'block';
        }

        // 让显示用经验逐帧逼近真实经验
        let expDiff = this.exp - this.displayExp;
        if (Math.abs(expDiff) > 0.01) {
            const step = Math.sign(expDiff) * this.expAnimationSpeed;
            if (Math.abs(step) > Math.abs(expDiff)) {
                this.displayExp = this.exp;
            } else {
                this.displayExp += step;
            }
        }
        // 如果经验动画已"显示到满"，再执行真正的升级
        if (this.displayExp >= this.expToNextLevel) {
            this.levelUp();             // 调用真正的升级逻辑
            this.displayExp = 0;        // 重置显示经验（条归0）
            this.exp = 0;              // 同时重置真实经验
        }
    }
}

// 子弹类
class Bullet {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.speed = 5; // 降低子弹飞行速度
        this.angle = angle;
        this.radius = 10;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'yellow';
        ctx.fill();
    }

    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
    }
}

// 怪物类
class Monster {
    constructor() {
        this.radius = 10;  // 增大怪物尺寸
        this.speed = 0.5;
        this.maxHealth = 3; // 最大血量
        this.health = this.maxHealth; // 当前血量
        this.setupPosition();
        this.expReward = 20;  // 基础经验值奖励
    }

    setupPosition() {
        // 相对于玩家位置生成怪物
        const side = Math.floor(Math.random() * 4);
        const offset = 800; // 在视野外生成怪物的距离
        
        switch(side) {
            case 0: // 上
                this.x = player.x - offset + Math.random() * offset * 2;
                this.y = player.y - offset;
                break;
            case 1: // 右
                this.x = player.x + offset;
                this.y = player.y - offset + Math.random() * offset * 2;
                break;
            case 2: // 下
                this.x = player.x - offset + Math.random() * offset * 2;
                this.y = player.y + offset;
                break;
            case 3: // 左
                this.x = player.x - offset;
                this.y = player.y - offset + Math.random() * offset * 2;
                break;
        }
    }

    draw() {
        // 绘制怪物身体
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'black'; // 改变怪物颜色为黑色
        ctx.fill();

        // 绘制血条背景
        const healthBarWidth = 40;
        const healthBarHeight = 5;
        const healthBarY = 30; // 血条距离怪物中心的距离
        
        ctx.fillStyle = '#666'; // 血条背景色
        ctx.fillRect(
            this.x - camera.x - healthBarWidth/2,
            this.y - camera.y - healthBarY,
            healthBarWidth,
            healthBarHeight
        );

        // 绘制当前血量
        ctx.fillStyle = 'red';
        ctx.fillRect(
            this.x - camera.x - healthBarWidth/2,
            this.y - camera.y - healthBarY,
            healthBarWidth * (this.health / this.maxHealth),
            healthBarHeight
        );
    }

    update(playerX, playerY) {
        ////////////////////////////////////////////////
        // 使怪物随时间推移而加速
        // 这里通过计算游戏运行时间，动态增大 speed
        const timeElapsed = (Date.now() - gameStartTime) / 60000; // 单位：分钟
        this.speed = 0.5 + timeElapsed * 0.5;  // 每过1分钟，速度额外增加0.5
        ////////////////////////////////////////////////

        const prevX = this.x;
        const prevY = this.y;

        // 计算向玩家移动的方向
        const angle = Math.atan2(playerY - this.y, playerX - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;

        ////////////////////////////////////////////////
        // ★ 移除与玩家碰撞后将怪物恢复到之前位置的逻辑
        // 这样怪物不会被推回，而是由主循环检测碰撞后直接消失
        // const distToPlayer = getDistance(this, player);
        // if (distToPlayer < this.radius + player.radius) {
        //    this.x = prevX;
        //    this.y = prevY;
        // }
        ////////////////////////////////////////////////

        // existing code to check collision with other monsters
        for (let monster of monsters) {
            if (monster !== this) {
                resolveCollision(this, monster);
            }
        }

        // 确保怪物不会被推出太远
        const distanceToPlayer = getDistance(this, player);
        const maxDistance = 1000; // 最大允许距离
        if (distanceToPlayer > maxDistance) {
            const angleToPlayer = Math.atan2(playerY - this.y, playerX - this.x);
            this.x = playerX - Math.cos(angleToPlayer) * maxDistance;
            this.y = playerY - Math.sin(angleToPlayer) * maxDistance;
        }
    }
}

// 游戏状态变量
const player = new Player();
let bullets = [];
let monsters = [];
let keys = {};
let gameActive = true;
let lastShootTime = 0;
let shootInterval = 300;   // 使用let以便可动态调整射击间隔
let camera = {
    x: 0,
    y: 0
};

// 用于记录虚拟摇杆触摸时的位置
let joystickData = { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 };

// 监听键盘事件
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

// 添加碰撞检测辅助函数
function getDistance(obj1, obj2) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function resolveCollision(obj1, obj2) {
    const dx = obj2.x - obj1.x;
    const dy = obj2.y - obj1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return; // 防止除以零

    const minDistance = obj1.radius + obj2.radius;
    if (distance < minDistance) {
        const angle = Math.atan2(dy, dx);
        const pushDistance = (minDistance - distance) / 2;

        // 将两个物体推开
        obj1.x -= Math.cos(angle) * pushDistance;
        obj1.y -= Math.sin(angle) * pushDistance;
        obj2.x += Math.cos(angle) * pushDistance;
        obj2.y += Math.sin(angle) * pushDistance;
    }
}

////////////////////////////////////////////////////////////
// 1) 在全局添加一个 expPacks 数组以存储经验包
////////////////////////////////////////////////////////////
let expPacks = [];

////////////////////////////////////////////////////////////
// 2) 修改怪物被子弹击杀时的逻辑：不再直接加经验，而是随机掉落经验包
////////////////////////////////////////////////////////////
monsters = monsters.filter(monster => {
    monster.update(player.x, player.y);
    monster.draw();

    // 怪物碰撞玩家扣血逻辑
    const dx = monster.x - player.x;
    const dy = monster.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < player.radius + monster.radius) {
        ///////////////////////////////////
        // 若有防御力，伤害减少
        const damage = Math.max(1 - player.defense, 0);
        player.health -= damage;
        // 若玩家血量 <= 0，游戏结束
        if (player.health <= 0) {
            gameActive = false;
            gameOverDiv.style.display = 'block';
        }
        return false;
    }

    // 检查子弹碰撞：伤害 = player.attack
    for (let bullet of bullets) {
        const bulletDx = bullet.x - monster.x;
        const bulletDy = bullet.y - monster.y;
        const bulletDistance = Math.sqrt(bulletDx * bulletDx + bulletDy * bulletDy);

        if (bulletDistance < bullet.radius + monster.radius) {
            bullets = bullets.filter(b => b !== bullet);
            monster.health -= player.attack; 
            if (monster.health <= 0) {
                /////////////////////////////////////////
                // 原先：player.gainExp(monster.expReward);
                // 改为：以50%概率生成经验包
                if (Math.random() < 0.5) {
                    expPacks.push(new ExpPack(monster.x, monster.y));
                }
                return false;  // 该怪物被移除
            }
            break;
        }
    }
    return true;
});

////////////////////////////////////////////////////////////
// 3) 新增 ExpPack 类：表示掉落在地上的经验包
////////////////////////////////////////////////////////////
class ExpPack {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 10;    // 经验包的拾取半径可自由调整
    }

    draw() {
        // 绘制一个简单的绿球表示经验包
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'green';
        ctx.fill();
    }
}

// 游戏主循环
function gameLoop() {
    if (!gameActive) return;

    // 修改射击逻辑，只生成一发子弹，并且不要垂直偏移
    const currentTime = Date.now();
    if (currentTime - lastShootTime >= shootInterval) {
        bullets.push(new Bullet(
            player.x + Math.cos(player.angle) * 40,
            player.y + Math.sin(player.angle) * 40,
            player.angle
        ));
        lastShootTime = currentTime;
    }

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 更新和绘制玩家
    player.update();
    player.draw();

    // 更新和绘制子弹
    bullets = bullets.filter(bullet => {
        bullet.update();
        bullet.draw();
        // 扩大子弹的有效范围
        const bulletScreenX = bullet.x - camera.x;
        const bulletScreenY = bullet.y - camera.y;
        return bulletScreenX > -500 && bulletScreenX < canvas.width + 500 && 
               bulletScreenY > -500 && bulletScreenY < canvas.height + 500;
    });

    // 更新和绘制怪物
    monsters = monsters.filter(monster => {
        monster.update(player.x, player.y);
        monster.draw();

        // 怪物碰撞玩家：伤害 = 1 - player.defense
        const dx = monster.x - player.x;
        const dy = monster.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < player.radius + monster.radius) {
            ///////////////////////////////////
            // 若有防御力，伤害减少
            const damage = Math.max(1 - player.defense, 0);
            player.health -= damage;
            // 若玩家血量 <= 0，游戏结束
            if (player.health <= 0) {
                gameActive = false;
                gameOverDiv.style.display = 'block';
            }
            return false;
        }

        // 检查子弹碰撞：伤害 = player.attack
        for (let bullet of bullets) {
            const bulletDx = bullet.x - monster.x;
            const bulletDy = bullet.y - monster.y;
            const bulletDistance = Math.sqrt(bulletDx * bulletDx + bulletDy * bulletDy);
            if (bulletDistance < bullet.radius + monster.radius) {
                bullets = bullets.filter(b => b !== bullet);
                monster.health -= player.attack; 
                if (monster.health <= 0) {
                    /////////////////////////////////////////
                    // 原先：player.gainExp(monster.expReward);
                    // 改为：以50%概率生成经验包
                    if (Math.random() < 0.5) {
                        expPacks.push(new ExpPack(monster.x, monster.y));
                    }
                    return false;  // 该怪物被移除
                }
                break;
            }
        }
        return true;
    });

    ////////////////////////////////////////////////
    // 4) 更新并绘制经验包，检测玩家拾取
    ////////////////////////////////////////////////
    expPacks = expPacks.filter(pack => {
        pack.draw();

        // 如果玩家接触到经验包，就加经验并移除
        const dist = Math.sqrt((player.x - pack.x)**2 + (player.y - pack.y)**2);
        if (dist < player.radius + pack.radius) {
            player.gainExp(10);  // 每拾取一次经验包获得10点经验
            return false;       // 从列表中移除该经验包
        }
        return true;
    });

    requestAnimationFrame(gameLoop);
}

// 启动游戏
gameLoop();

// 在游戏开始时，额外生成一些怪物
spawnMonsters(10); // 可自行调节数量

////////////////////////////////////////////////////////////////////////////////
// 4) 定义暂停 / 恢复游戏的函数
////////////////////////////////////////////////////////////////////////////////
function pauseGame() {
    gameActive = false;
}

function resumeGame() {
    if (!gameActive) {
        gameActive = true;
        requestAnimationFrame(gameLoop);
    }
}

////////////////////////////////////////////////////////////////////////////////
// 5) 定义一个升级面板逻辑：随机抽3个选项并设置按钮点击事件
////////////////////////////////////////////////////////////////////////////////
const allUpgrades = [
    {
        name: '加血',
        apply: () => { player.health += 5; }
    },
    {
        name: '加移速',
        apply: () => { player.speed += 0.5; }
    },
    {
        name: '加攻击力',
        apply: () => { player.attack += 1; }
    },
    {
        name: '加防御力',
        apply: () => { player.defense += 0.2; }
    },
    {
        name: '加攻速',
        apply: () => {
            // 每次升级时减少射击间隔50，但不低于50
            // (具体数值可根据需要调小或调大)
            shootInterval = Math.max(shootInterval - 50, 50);
        }
    }
];

function openUpgradeModal() {
    // 随机抽取3个不同的升级项
    const upgradeModal = document.getElementById('upgradeModal');
    const btn1 = document.getElementById('upgradeBtn1');
    const btn2 = document.getElementById('upgradeBtn2');
    const btn3 = document.getElementById('upgradeBtn3');

    // 将 allUpgrades 数组打乱并取前三个
    const shuffled = [...allUpgrades].sort(() => 0.5 - Math.random());
    const chosen = shuffled.slice(0, 3);

    // 分别给按钮赋值
    btn1.textContent = chosen[0].name;
    btn2.textContent = chosen[1].name;
    btn3.textContent = chosen[2].name;

    // 移除原先事件以防止重复叠加
    btn1.onclick = null;
    btn2.onclick = null;
    btn3.onclick = null;

    // 给三个按钮绑定各自的 apply 方法
    btn1.onclick = () => {
        chosen[0].apply();
        closeUpgradeModal();
    };
    btn2.onclick = () => {
        chosen[1].apply();
        closeUpgradeModal();
    };
    btn3.onclick = () => {
        chosen[2].apply();
        closeUpgradeModal();
    };

    // 显示弹窗
    upgradeModal.style.display = 'block';
}

function closeUpgradeModal() {
    const upgradeModal = document.getElementById('upgradeModal');
    upgradeModal.style.display = 'none';
    // 玩家选择完毕后，恢复游戏
    resumeGame();
}

////////////////////////////////////////////////////
// 新增 spawnMonsters 函数：用于按需生成怪物
////////////////////////////////////////////////////
function spawnMonsters(count) {
    for (let i = 0; i < count; i++) {
        monsters.push(new Monster());
    }
}

// 设置初始等级的怪物生成速度（或者在此之前先生成若干怪物）
updateMonsterSpawnInterval();

////////////////////////////////////////////////////////////////////////
// 新增：监听触摸事件，控制虚拟摇杆
////////////////////////////////////////////////////////////////////////
const joystickOuter = document.getElementById('joystickOuter');
const joystickInner = document.getElementById('joystickInner');

joystickOuter.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.targetTouches[0];
    // 记录初始触摸位置
    joystickData.active = true;
    joystickData.startX = touch.clientX;
    joystickData.startY = touch.clientY;
    joystickData.currentX = touch.clientX;
    joystickData.currentY = touch.clientY;
    updateJoystickVisual();
});

joystickOuter.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!joystickData.active) return;
    const touch = e.targetTouches[0];
    // 更新当前触摸位置
    joystickData.currentX = touch.clientX;
    joystickData.currentY = touch.clientY;
    updateJoystickVisual();
});

joystickOuter.addEventListener('touchend', (e) => {
    e.preventDefault();
    // 复位摇杆位置
    joystickData.active = false;
    joystickInner.style.left = '40px';
    joystickInner.style.top = '40px';
    // 松开后取消所有方向键
    keys.ArrowUp = false;
    keys.ArrowDown = false;
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
});

/**
 * 将摇杆偏移转换为 ArrowUp/Down/Left/Right
 * 并更新摇杆视觉位置
 */
function updateJoystickVisual() {
    const outerRect = joystickOuter.getBoundingClientRect();
    const centerX = outerRect.left + outerRect.width / 2;
    const centerY = outerRect.top + outerRect.height / 2;

    // 计算当前触摸与中心点的偏移
    let dx = joystickData.currentX - centerX;
    let dy = joystickData.currentY - centerY;

    // 摇杆半径
    const radius = outerRect.width / 2; // 60px

    // 检测距离是否超过外圈半径，若超过则限幅
    const distance = Math.sqrt(dx*dx + dy*dy);
    if (distance > radius) {
        const angle = Math.atan2(dy, dx);
        dx = Math.cos(angle) * radius;
        dy = Math.sin(angle) * radius;
    }

    // 设置内圈位置，使其与手指保持一致或到外圈边缘
    const innerX = 40 + dx; // 初始 left=40
    const innerY = 40 + dy; // 初始 top=40
    joystickInner.style.left = innerX + 'px';
    joystickInner.style.top = innerY + 'px';

    // 根据 dx, dy 计算方向并设置 keys
    const deadZone = 10; // 若移动较小则视为不动
    // 先全部 false
    keys.ArrowUp = false;
    keys.ArrowDown = false;
    keys.ArrowLeft = false;
    keys.ArrowRight = false;

    // 若 dy < -deadZone => Up
    if (dy < -deadZone) {
        keys.ArrowUp = true;
    }
    // 若 dy > deadZone => Down
    if (dy > deadZone) {
        keys.ArrowDown = true;
    }
    // 若 dx < -deadZone => Left
    if (dx < -deadZone) {
        keys.ArrowLeft = true;
    }
    // 若 dx > deadZone => Right
    if (dx > deadZone) {
        keys.ArrowRight = true;
    }
} 