import * as odd from "@oddjs/odd";

let program = null
async function getProgram() {
  if (!program) {
    const appInfo = { creator: "Shovel", name: "Rolod" }
    program = await odd.program({ namespace: appInfo, debug: true })
      .catch(error => {
        switch (error) {
          case odd.ProgramError.InsecureContext:
            // ODD requires HTTPS
            break;
          case odd.ProgramError.UnsupportedBrowser:
            // Browsers must support IndexedDB
            break;
        }
      })
  }

  return program;
}

async function getSession(program) {
  let session
  if (program.session) {
    session = program.session
  }

  return session;
}

async function signup(username) {
  var program = await getProgram()
  var session = await getSession(program)
  const valid = await program.auth.isUsernameValid(username)
  const available = await program.auth.isUsernameAvailable(username)
  console.log("username available", available)

  if (valid && available) {
    console.log("registering ...", username)
    // Register the user
    const { success } = await program.auth.register({ username: username })
    console.log("success: ", success)
    // Create a session on success
    session = success ? await program.auth.session() : null
  }

  //create fs
  console.log("newly created session: ", session)
  const fs = session.fs
  console.log(fs)
  const profileData = JSON.stringify({ "handle": username, "name": "John Doe" })
  const contactData = JSON.stringify({ contactList: {} })

  const { RootBranch } = odd.path
  const profileFilePath = odd.path.file(RootBranch.Private, "profile.json")
  const contactFilePath = odd.path.file(RootBranch.Private, "contacts.json")

  await fs.write(profileFilePath, new TextEncoder().encode(profileData))
  await fs.write(contactFilePath, new TextEncoder().encode(contactData))
  await fs.publish()

  const content = new TextDecoder().decode(await fs.read(profileFilePath))
  console.log("profile data :", content)

  const timeout = setTimeout(() => {
    clearTimeout(timeout)
    window.location.href = "/app";
  }, 5000)
}

async function getProfile() {
  var program = await getProgram();
  var session = await getSession(program);

  const fs = session.fs;
  const { RootBranch } = odd.path
  const privateFilePath = odd.path.file(RootBranch.Private, "profile.json")

  const pathExists = await fs.exists(privateFilePath)
  if (pathExists) {
    const content = new TextDecoder().decode(await fs.read(privateFilePath))
    return JSON.parse(content)
  }
}

async function getContacts() {
  var program = await getProgram();
  var session = await getSession(program);
  const fs = session.fs;
  const { RootBranch } = odd.path
  const privateFilePath = odd.path.file(RootBranch.Private, "contacts.json")
  const pathExists = await fs.exists(privateFilePath)
  if (pathExists) {
    const content = new TextDecoder().decode(await fs.read(privateFilePath))
    return JSON.parse(content)
  }
}

async function updateProfile(name) {
  await updateFile("profile.json", (content) => {
    content.name = name
    return content
  })
}
async function addContact(newContact) {
  await updateFile("contacts.json", (content) => {
    var id = crypto.randomUUID()
    content.contactList[id] = newContact
    return content
  })
}

async function editContact(id, contact) {
  await updateFile("contacts.json", (content) => {
    var contactList = content.contactList
    contactList[id] = contact
    return content
  })
}

async function deleteContact(id) {
  await updateFile("contacts.json", (content) => {
    delete content.contactList[id]
    console.log("delete", id)
    console.log("delete", content.contactList)
    return content
  })
}

async function updateFile(file, mutationFunction) {
  var program = await getProgram();
  var session = await getSession(program);

  const fs = session.fs;
  const { RootBranch } = odd.path
  const contactFilePath = odd.path.file(RootBranch.Private, file)

  const content = new TextDecoder().decode(await fs.read(contactFilePath))
  const newContent = mutationFunction(JSON.parse(content))

  await fs.write(contactFilePath, new TextEncoder().encode(JSON.stringify(newContent)))
  await fs.publish()

  const readContent = new TextDecoder().decode(await fs.read(contactFilePath))
  console.log("contacts :", readContent)
  return readContent;
}

async function signout() {
  var program = await getProgram();
  var session = await getSession(program);
  await session.destroy()
}

async function producerChallengeProcessor(challenge, userInput) {
  console.log("i am here")
  console.log("challenge pin", challenge.pin)
  console.log("userinput", userInput)

  // Either show `challenge.pin` or have the user input a PIN and see if they're equal.
  if (userInput === challenge.pin.join("")) {
    challenge.confirmPin(); alert("success")
  } else {
    challenge.rejectPin(); alert("wrong pin")
  }
}

async function waitForDataRoot(username) {
  const program = await getProgram()
  const reference = program?.components.reference
  const EMPTY_CID = "Qmc5m94Gu7z62RC8waSKkZUrCCBJPyHbkpmGzEePxy2oXJ"

  if (!reference)
    throw new Error("Program must be initialized to check for data root")

  let dataRoot = await reference.dataRoot.lookup(username)

  if (dataRoot.toString() !== EMPTY_CID) return

  return new Promise((resolve) => {
    const maxRetries = 50
    let attempt = 0

    const dataRootInterval = setInterval(async () => {
      dataRoot = await reference.dataRoot.lookup(username)

      if (dataRoot.toString() === EMPTY_CID && attempt < maxRetries) {
        attempt++
        return
      }

      clearInterval(dataRootInterval)
      resolve()
    }, 500)
  })
}

export {
  signup,
  getProfile,
  updateProfile,
  getContacts,
  addContact,
  editContact,
  deleteContact,
  signout,
  getSession,
  getProgram,
  producerChallengeProcessor,
  waitForDataRoot,
};
