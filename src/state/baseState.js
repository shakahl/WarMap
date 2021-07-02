import allRounds from "../assets/data/rounds/allRounds"
import mapMeta from "../assets/data/map-meta.json"
import zoneInfo from "../assets/data/zones/zone-info.json"
import allBackstories from "../assets/data/backstories.json"
import fighters from "./fighter-loader"

const defaultState = {
  curSelected: "NA",
  curRound: 0,
  roundData: allRounds,
  metaMap: mapMeta,
  zoneDesc: zoneInfo,
  allFighters: fighters,
  revealed: [[], [], [], [], [], [], [], [], []],
  localStorageAvailable: null,
  readingList: {},
  backstories: allBackstories,
  showGraphics: true,
  showItems: true,
  showLabels: true,
  showSummary: false
}

export default defaultState
