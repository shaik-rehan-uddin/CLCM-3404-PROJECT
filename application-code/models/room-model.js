//imports built in

//inports 3rd party

//imports custom
const db = require("../data/database");
const gameUtil = require("../utils/game-util");
const ObjectId = require("mongodb").ObjectId;
const Player = require("../models/player-model");
const GameMove = require("../models/game-move-model");
const GameStatus = require("../models/game-status-model");

class Room {
  constructor(
    players,
    gameStatus,
    creationDate,
    lastChangeDate,
    blocked,
    owned,
    roomId
  ) {
    this.players = players; //Array[1,2] of class Player
    this.gameStatus = gameStatus; //Object of class GameStatus
    this.available = this.isAvailable();

    if (creationDate) {
      this.creationDate = creationDate;
      if (lastChangeDate) {
        this.lastChangeDate = lastChangeDate;
      } else {
        throw new Error(
          "A value for lastChangeDate needs to pe passed to the Room constructor if a value for creationDate was passed"
        );
      }
    } else {
      this.creationDate = new Date(); //now
      this.lastChangeDate = this.creationDate;
    }

    this.blocked = blocked;
    this.owned = owned;

    if (roomId) {
      this.roomId = roomId.toString();
    }
  }

  //create a new Room object, initialized for a player requesting a new game session
  //(this is used in case no available room in the DB was found
  static createEmpty(isPrivate) {
    //init the values of the new room
    const emptyBoard = gameUtil.getEmptyBoard();
    const emptyGameMove = new GameMove(0, [null, null], "null");
    const gameStatus = new GameStatus(emptyBoard, emptyGameMove);
    const player1 = new Player("", "", 0, false, false);
    const player2 = new Player("", "", 0, false, false);
    //create and return the new room
    return new Room(
      [player1, player2],
      gameStatus,
      null, //creation date = now
      null, //last change date = ??
      false, //not blocked
      isPrivate //owned
      //no room id
    );
  }

  //generate Room class obj from mongodb document
  static fromMongoDBDocumentToRoom(document) {
    //if no document return undefined
    if (!document) {
      return undefined;
    }

    //transform players of the document as Player class objects
    const player1 = Player.fromMongoDBDocumentToPlayer(document.players[0]);
    const player2 = Player.fromMongoDBDocumentToPlayer(document.players[1]);

    //transform game status of the document as GameStatus class object
    const gameStatus = GameStatus.fromMongoDBDocumentToGameStatus(
      document.gameStatus
    );

    //create and return Room class object
    return new Room(
      [player1, player2],
      gameStatus,
      document.creationDate,
      document.lastChangeDate,
      document.blocked,
      document.owned,
      document._id
    );
  }

  //find the first available and non-blocked game room
  //NOTE: the room to look for must be different than the one already assigned
  //to the session if game data are already present
  static async findAvailableAndBlock(roomIdToSkip) {
    //define query filter
    const query = {
      available: true,
      blocked: false,
      owned: false,
    };

    //skip room with passed id
    if (roomIdToSkip) {
      query._id = {
        $ne: new ObjectId(roomIdToSkip),
      };
    }

    //value to update in the room document
    const update = { $set: { blocked: true } };

    //option to return the updated document
    const options = { returnUpdatedDocument: true };

    //run query
    const document = await db
      .getDb()
      .collection("rooms")
      .findOneAndUpdate(query, update, options);

    //return Room class obj
    return Room.fromMongoDBDocumentToRoom(document.value); //still returns undefined if no document is found
  }

  //find a room by its id
  static async findById(roomId) {
    //define query filter
    const query = { _id: new ObjectId(roomId) };

    //run query
    const document = await db.getDb().collection("rooms").findOne(query);

    //no room found
    if (!document) {
      throw new Error("No room found");
    }
    //return Room class obj
    return Room.fromMongoDBDocumentToRoom(document); //still returns undefined if no document is found
  }

  //check whether a client can be assigned or access this room based on the game data of his session
  static async findByIdAndCheckAccessRights(roomId, sessionGameData) {
    //check if room exissts
    const room = await Room.findById(roomId);
    //check if room is actually private
    if (!room.owned) {
      throw new Error("User requested to join a non private room");
    } else {
      //check if user is trying to access a non available (full) room where already two users
      //are playing there, and none of the is the user
      if (sessionGameData) {
        if (!room.available && sessionGameData.roomId !== roomId) {
          throw new Error(
            "User requested to join a private room, but the room is already full"
          );
        }
      } else if (!room.available) {
        throw new Error(
          "User requested to join a private room, but the room is already full"
        );
      }
    }
    return room;
  }

  //delete all rooms matching a filter
  static async deleteByFilter(query) {
    await db.getDb().collection("rooms").deleteMany(query);
  }

  //cyclically deletes inactive rooms in the DB every delay time in[ms].
  //A room is considered inactive when its lastChangeDate is elder than the passed inactive time in [ms]
  static async deleteInactiveRoomsCiclically(delay, maxInactiveTime) {
    //check if inputs make sense
    const oneHour_ms = 1000 * 60 * 60;
    const filteredDelay = +delay;
    const filteredMaxInactiveTime = +maxInactiveTime;
    if (
      !filteredDelay ||
      filteredDelay < 1 * oneHour_ms ||
      !filteredMaxInactiveTime ||
      filteredMaxInactiveTime < 1 * oneHour_ms
    ) {
      throw Error("Delay parameter not ok");
    }
    //define inactive rooms to be deleted
    const dateNow_ms = new Date().getTime();
    const query = {
      lastChangeDate: { $lt: new Date(dateNow_ms - filteredMaxInactiveTime) },
    };
    //debugging
    console.log("Check for inactive rooms to delete");
    try {
      await Room.deleteByFilter(query);
    } catch (error) {
      console.log(error);
    }
    setTimeout(function () {
      Room.deleteInactiveRoomsCiclically(
        filteredDelay,
        filteredMaxInactiveTime
      );
    }, filteredDelay);
  }

  //block a specific room in the DB
  static blockById(roomId) {
    const query = {
      _id: new ObjectId(roomId),
    };
    const update = { $set: { blocked: true } };
    db.getDb()
      .collection("rooms")
      .updateOne(query, update)
      .catch(function (error) {
        console.log(`Failed to block the room with id ${roomId}`);
        console.log(error);
      });
  }

  //check if room is available (at leas 1 player slot is available)
  isAvailable() {
    //update room availability status
    if (!this.getAvailablePlayerSlot()) {
      return false;
    } else {
      return true;
    }
  }

  //save/update a game room in the DB: save a new one if not pointing to an existing room
  async save() {
    let result;
    if (!this.roomId) {
      const document = this.fromRoomToMongoDBDocument();
      result = await db.getDb().collection("rooms").insertOne(document);
      return result.insertedId;
    } else {
      //query filter
      const query = { _id: new ObjectId(this.roomId) };

      //update filter
      const updatedDocument = this.fromRoomToMongoDBDocument();
      //last change date = now
      updatedDocument.lastChangeDate = new Date();
      const update = { $set: updatedDocument };

      //run query
      result = await db.getDb().collection("rooms").updateOne(query, update);
      return result.matchedCount;
    }
  }

  //return one specific player data
  getPlayer(playerNumber) {
    return this.players[playerNumber - 1];
  }

  //set one player data in players array: gets Player class parameter
  addPlayer(player) {
    //add a player in the room
    this.players[player.number - 1] = player;
    //update room availability status
    this.available = this.isAvailable();
  }

  //delete player data in a specific player slot
  removePlayer(playerNumber) {
    //delete player data
    this.players[playerNumber - 1].name = "";
    this.players[playerNumber - 1].symbol = "";
    this.players[playerNumber - 1].number = 0;
    //now room is available for another player to connect
    this.available = true;
  }

  //update players hasTurn property
  //NOTE: playerNumbe --> number of the player who made successfully a game move
  //Example: if player 1 made successfully his move, then it is the turn of player 2
  setPlayersTurn(playerNumber) {
    this.players[playerNumber - 1].hasTurn = false;
    const otherPlayerNumber = gameUtil.getOtherPlayerNumber(playerNumber);
    this.players[otherPlayerNumber - 1].hasTurn = true;
  }

  //check if one player 1 or 2 is connected to the room
  isPlayerSlotAvailable(playerNumber) {
    //extract player data
    const name = this.players[playerNumber - 1].name;
    const symbol = this.players[playerNumber - 1].symbol;
    const number = this.players[playerNumber - 1].number;
    //player is connected if he has ALL non-empty data values
    return !name && !symbol && !number;
  }

  //check if in this room a player 1 or 2 slot is available, and return it.
  //If both slots are available, return player 1 as default
  getAvailablePlayerSlot() {
    //check player slots availability
    const isPlayer1SlotAvailable = this.isPlayerSlotAvailable(1);
    const isPlayer2SlotAvailable = this.isPlayerSlotAvailable(2);
    //
    if (isPlayer1SlotAvailable && isPlayer2SlotAvailable) {
      return 1;
    } else if (isPlayer1SlotAvailable && !isPlayer2SlotAvailable) {
      return 1;
    } else if (!isPlayer1SlotAvailable && isPlayer2SlotAvailable) {
      return 2;
    } else {
      return undefined;
    }
  }

  //returnes the symbol not used by players in the room yet.
  //If both symbols are available, return X as default
  getAvailableGameSymbol() {
    //extract player symbols
    const player1Symbol = this.players[0].symbol;
    const player2Symbol = this.players[1].symbol;
    //find symbol not used yet (availabele)
    if (!player1Symbol && !player2Symbol) {
      return "X";
    } else if (player1Symbol && !player2Symbol) {
      if (player1Symbol === "X") {
        return "O";
      } else if (player1Symbol === "O") {
        return "X";
      }
    } else if (!player1Symbol && player2Symbol) {
      if (player2Symbol === "X") {
        return "O";
      } else if (player2Symbol === "O") {
        return "X";
      }
    } else {
      return undefined;
    }
  }

  //set game start request
  initGameRestart() {
    this.players[0].restartingRequest = true;
    this.players[1].restartingRequest = true;
  }

  //handle game restarting requests
  handleGameRestart(thisPlayerNumber) {
    const otherPlayerNumber = gameUtil.getOtherPlayerNumber(thisPlayerNumber);
    //check if players are requesting to restart the game
    const thisPlayerRestartingRequest =
      this.players[thisPlayerNumber - 1].restartingRequest;
    const otherPlayerRestartingRequest =
      this.players[otherPlayerNumber - 1].restartingRequest;
    if (thisPlayerRestartingRequest) {
      this.players[thisPlayerNumber - 1].restartingRequest = false;
      if (otherPlayerRestartingRequest) {
        this.gameStatus.reset();
      }
    }
  }

  //check if for this room geme restart was already requested
  isGameRestartInitialized() {
    return (
      this.players[0].restartingRequest && this.players[1].restartingRequest
    );
  }

  //generate mongodb document from Room class obj
  fromRoomToMongoDBDocument() {
    return {
      players: this.players,
      gameStatus: this.gameStatus,
      available: this.available,
      creationDate: this.creationDate,
      lastChangeDate: this.lastChangeDate,
      blocked: this.blocked,
      owned: this.owned,
    };
  }
}

//export
module.exports = Room;
