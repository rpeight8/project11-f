import React, { useState, useEffect, useCallback } from "react";
import "./QuizApp.css";

const QuizApp = () => {
  const [ws, setWs] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [gameState, setGameState] = useState("join"); // join, waiting, playing, results
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [players, setPlayers] = useState([]);
  const [timer, setTimer] = useState(null);
  const [results, setResults] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAdmin] = useState(true); // For testing purposes

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3000");

    socket.onopen = () => {
      console.log("Connected to server");
      setWs(socket);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleServerMessage(data);
    };

    return () => {
      socket.close();
    };
  }, []);

  const handleServerMessage = (data) => {
    switch (data.type) {
      case "PLAYER_LIST_UPDATE":
        setPlayers(data.payload);
        break;
      case "NEW_QUESTION":
        setCurrentQuestion(data.payload.question);
        setGameState("playing");
        setSelectedAnswer(null);
        break;
      case "TIMER_UPDATE":
        setTimer(data.payload.remaining);
        break;
      case "QUESTION_RESULTS":
        setResults(data.payload);
        setGameState("results");
        break;
      case "GAME_OVER":
        setGameState("gameOver");
        setResults(data.payload);
        break;
    }
  };

  const joinGame = () => {
    if (playerName && ws) {
      ws.send(
        JSON.stringify({
          type: "JOIN_GAME",
          payload: {
            name: playerName,
            color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
          },
        })
      );
      setGameState("waiting");
    }
  };

  const startGame = () => {
    if (ws && isAdmin) {
      ws.send(
        JSON.stringify({
          type: "START_GAME",
          isAdmin: true,
        })
      );
    }
  };

  const submitAnswer = (answer) => {
    if (ws && currentQuestion) {
      setSelectedAnswer(answer);
      ws.send(
        JSON.stringify({
          type: "SUBMIT_ANSWER",
          payload: answer,
        })
      );
    }
  };

  const renderJoinScreen = () => (
    <div className="join-screen">
      <h2>Join Quiz Game</h2>
      <input
        type="text"
        placeholder="Enter your name"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
      />
      <button onClick={joinGame}>Join Game</button>
    </div>
  );

  const renderWaitingScreen = () => (
    <div className="waiting-screen">
      <h2>Waiting for Game to Start</h2>
      <div className="players-list">
        <h3>Players:</h3>
        {players.map((player, index) => (
          <div
            key={index}
            className="player-item"
            style={{ color: player.color }}
          >
            {player.name}
          </div>
        ))}
      </div>
      {isAdmin && <button onClick={startGame}>Start Game</button>}
    </div>
  );

  const renderQuestion = () => (
    <div className="question-screen">
      <div className="timer">Time remaining: {timer}s</div>
      <h2>{currentQuestion.question}</h2>
      <div className="options">
        {currentQuestion.options.map((option, index) => (
          <button
            key={index}
            onClick={() => submitAnswer(index)}
            className={selectedAnswer === index ? "selected" : ""}
            disabled={selectedAnswer !== null}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );

  const renderResults = () => (
    <div className="results-screen">
      <h2>Results</h2>
      <div className="results-list">
        {results?.results.map((result, index) => (
          <div key={index} className="result-item">
            <span>{result.name}</span>
            <span>{result.correct ? "✅" : "❌"}</span>
            <span>Score: {result.score}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="quiz-app">
      {gameState === "join" && renderJoinScreen()}
      {gameState === "waiting" && renderWaitingScreen()}
      {gameState === "playing" && renderQuestion()}
      {(gameState === "results" || gameState === "gameOver") && renderResults()}
    </div>
  );
};

export default QuizApp;
