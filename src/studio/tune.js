// Hug Studio 调试模式的可调倍率。游戏本身只读这些值；默认全是「原样」，不开 ?edit 时永远不变。
export const TUNE_DEFAULT = {
  speed: 1,      // 时间速度
  amb: 1,        // 环境光
  moon: 1,       // 月光（主方向光）
  orb: 1,        // 星光亮度
  orbR: 1,       // 星光照射距离
  bloom: 1,      // 泛光强度
  thresh: .75,   // 泛光门槛（越低越容易发光）
  dof: 1,        // 景深模糊
  vig: 1,        // 暗角
  pal: .18,      // 调色板吸附（像素画色感）
  free: false    // 自由移动：穿墙、走过虚空不掉落
};
export const TUNE = { ...TUNE_DEFAULT };
