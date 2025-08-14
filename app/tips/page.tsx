import { TipsInfo } from '../components/tips-info'
import React from 'react'
import tipsData from './tipsdata.json'
import tipstext from './tipstext.json'

import { NavBar } from '../components/nav_bar'


interface TipText {
  text: string
}

// Assert the type of tipstext
const tipTextArray = tipstext as TipText[]

const Tips = () => {
  return (
    <div className="container mx-auto px-4 mt-6">
      <NavBar />

      <div className="container mx-auto px-4 py-8 mt-16">
        <div className="flex items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold">Case Interview Tips</h1>
        </div>
        <p className="text-gray-600 mb-8 whitespace-pre-wrap">{tipTextArray[0].text}</p>
        <TipsInfo items={tipsData} />
      </div>
    </div>
  )
}

export default Tips
