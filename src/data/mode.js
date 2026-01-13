const Modes = {
    None: 0,
    NF: 1,             // NoFail
    EZ: 2,             // Easy
    TD: 4,             // TouchDevice
    HD: 8,             // Hidden
    HR: 16,            // HardRock
    SD: 32,            // SuddenDeath
    DT: 64,            // DoubleTime
    RL: 128,           // Relax
    HT: 256,           // HalfTime
    NC: 512,           // Nightcore
    FL: 1024,          // Flashlight
    AT: 2048,          // Autoplay
    SO: 4096,          // SpunOut
    AP: 8192,          // AutoPilot
    PF: 16384,         // Perfect
    Key4: 32768,
    Key5: 65536,
    Key6: 131072,
    Key7: 262144,
    Key8: 524288,
    FI: 1048576,       // FadeIn
    RD: 2097152,       // Random
    CM: 4194304,       // Cinema
    Target: 8388608,
    Key9: 16777216,
    Key10: 33554432,
    Key1: 67108864,
    Key3: 134217728,
    Key2: 268435456,
    ScoreV2: 536870912,
    MR: 1073741824,    // Mirror
    KeyMod : Key1 | Key2 | Key3 | Key4 | Key5 | Key6 | Key7 | Key8 | Key9 | KeyCoop,
    FreeModAllowed : NoFail | Easy | Hidden | HardRock | SuddenDeath | Flashlight | FadeIn | Relax | Relax2 | SpunOut | KeyMod,
    ScoreIncreaseMods : Hidden | HardRock | DoubleTime | Flashlight | FadeIn
};

// 모드 체크 함수
function checkModes (modes_num){
    if (modes_num == 0){
        return "None";
    }
    if (modes_num & Modes.Nightcore){
        modes_num &= ~Modes.DoubleTime;
    }
    if (modes_num & Modes.Perfect){
        modes_num &= ~Modes.SuddenDeath;
    }
    let convertModes = Object.keys(Modes)
        .filter(mode => (modes_num & Modes[mode]) !== 0)
        .join(", ");
    return convertModes;
}