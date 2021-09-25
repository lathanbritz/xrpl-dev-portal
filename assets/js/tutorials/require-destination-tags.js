// 1. Generate
// 2. Connect
// The code for these steps is handled by interactive-tutorial.js
$(document).ready(() => {

  // 3. Send AccountSet --------------------------------------------------------
  $("#send-accountset").click( async (event) => {
    const address = get_address(event)
    if (!address) {return}

    try {
      await generic_full_send(event, {
        "TransactionType": "AccountSet",
        "Account": address,
        "SetFlag": 1 // RequireDest
      })
      complete_step("Send AccountSet")
    } catch(err) {
      block.find(".loader").hide()
      show_error(block, err)
    }
  })

  // 4. Wait for Validation: handled by interactive-tutorial.js and by the
  // generic full send in the previous step. -----------------------------------

  // 5. Confirm Account Settings -----------------------------------------------
  $("#confirm-settings").click( async (event) => {
    const block = $(event.target).closest(".interactive-block")
    const address = get_address(event)
    if (!address) {return}

    block.find(".output-area").html("")
    block.find(".loader").show()
    let account_info = await api.request({
        "command": "account_info",
        "account": address,
        "ledger_index": "validated"
    })
    console.log(account_info)
    // TODO: what's the replacement for parseAccountFlags?
    //const flags = api.parseAccountFlags(account_info.account_data.Flags)
    block.find(".loader").hide()

    block.find(".output-area").append(
        `<pre><code>${pretty_print(flags)}</code></pre>`)
    //if (flags.requireDestinationTag) {
    if (account_info.result.account_data.Flags | 0x00020000) { // TODO: change this back if there's a better way
      block.find(".output-area").append(`<p><i class="fa fa-check-circle"></i>
          Require Destination Tag is enabled.</p>`)
    } else {
      block.find(".output-area").append(`<p><i class="fa fa-times-circle"></i>
          Require Destination Tag is DISABLED.</p>`)
    }

    complete_step("Confirm Settings")
  })

  // Send Test Payments --------------------------------------------------------

  // Helper to get an address to send the test payments from. Save the values
  // from the faucet in data attributes on the block so we don't have to get a
  // new sending address every time.
  async function get_test_sender(block) {
    let address = block.data("testSendAddress")
    let secret = block.data("testSendSecret")
    if (!address || !secret) {
      console.debug("First-time setup for test sender...")
      // Old way:
      // const faucet_url = $("#generate-creds-button").data("fauceturl")
      // const data = await call_faucet(faucet_url)
      // address = data.account.classicAddress
      // block.data("testSendAddress", address)
      // secret = data.account.secret
      // block.data("testSendSecret", secret)
      // New way: get a wallet
      let test_sender_wallet = await api.generateFaucetWallet()
      block.data("testSendAddress", test_sender_wallet.classicAddress)
      block.data("testSendSecret", test_sender_wallet.seed)

      // First time: Wait for our test sender to be fully funded, so we don't
      // get the wrong starting sequence number.
      while (true) {
        try {
          await api.request({command: "account_info", account: address, ledger_index: "validated"})
          break
        } catch(e) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }
    return test_sender_wallet
  }

  // Actual handler for the two buttons in the Send Test Payments block.
  // Gets the destination tag (or lack thereof) from their data attributes.
  $(".test-payment").click( async (event) => {
    const block = $(event.target).closest(".interactive-block")
    const address = get_address(event)
    if (!address) {return}

    block.find(".loader").show()
    try {
      const test_sender = await get_test_sender(block)
      const tx_json = {
        "TransactionType": "Payment",
        "Account": test_sender.classicAddress,
        "Amount": "3152021",
        "Destination": address
      }
      const dt = $(event.target).data("dt")
      if (dt) {
        tx_json["DestinationTag"] = parseInt(dt)
      }

      const prepared = await api.autofill(tx_json)
      const tx_blob = test_sender.signTransaction(prepared)
      console.debug("Submitting test payment", prepared)
      const prelim = await api.request({"command": "submit", tx_blob})
      const tx_hash = xrpl.computeSignedTransactionHash(tx_blob)

      block.find(".loader").hide()
      block.find(".output-area").append(`<p>${tx_json.TransactionType}
        ${prepared.Sequence} ${(dt?"WITH":"WITHOUT")} Dest. Tag:
        <a href="https://testnet.xrpl.org/transactions/${tx_hash}"
        target="_blank">${prelim.result.engine_result}</a></p>`)
    } catch(err) {
      block.find(".loader").hide()
      show_error(block, `An error occurred when sending the test payment: ${err}`)
    }
  })

})
