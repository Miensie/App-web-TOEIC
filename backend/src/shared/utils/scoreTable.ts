const CONVERSION_TABLE: number[] = [
  5,   5,   5,   5,   5,   5,   5,   5,   5,   5,
  10,  15,  20,  25,  30,  35,  40,  45,  50,  55,
  60,  65,  70,  75,  80,  85,  90,  95, 100, 105,
  110, 115, 120, 125, 130, 135, 140, 145, 150, 155,
  160, 165, 170, 175, 180, 185, 190, 200, 210, 220,
  230, 240, 250, 260, 270, 280, 290, 300, 310, 320,
  330, 340, 350, 360, 370, 380, 385, 390, 395, 400,
  405, 410, 415, 420, 425, 430, 435, 440, 445, 450,
  455, 460, 465, 470, 475, 480, 485, 490, 490, 495,
  495, 495, 495, 495, 495, 495, 495, 495, 495, 495,
  495,
];

export function convertToToeicScore(correct: number): number {
  return CONVERSION_TABLE[Math.max(0, Math.min(100, correct))];
}

export function calculateToeicScores(listeningCorrect: number, readingCorrect: number) {
  const listeningScore = convertToToeicScore(listeningCorrect);
  const readingScore = convertToToeicScore(readingCorrect);
  return { listeningScore, readingScore, totalScore: listeningScore + readingScore };
}