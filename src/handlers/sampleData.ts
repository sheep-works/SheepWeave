export const sampleProjectData = {
  "define": {
    "name": "SHWV_DATA",
    "version": "1.3"
  },
  "meta": {
    "bilingualPath": "",
    "files": [
      {
        "name": "SheepWeaveSample.docx.xlf",
        "start": 0,
        "end": 28
      }
    ],
    "sourceLang": "en-us",
    "targetLang": "ja-jp",
    "projectName": "SheepWeaveSample",
    "tmFiles": [],
    "tbFiles": []
  },
  "body": {
    "units": [
      {
        "idx": 0,
        "src": "Welcome to Sheep Translation Studio.",
        "pre": "",
        "tgt": "Welcome to Sheep Translation Studio.",
        "status": 0,
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 1,
        "src": "A sheep finds a word.",
        "pre": "",
        "tgt": "A sheep finds a word.",
        "status": 0,
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [
            [
              4,
              75
            ],
            [
              2,
              75
            ]
          ],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 2,
        "src": "Another sheep finds a similar word.",
        "pre": "",
        "tgt": "Another sheep finds a similar word.",
        "status": 0,
        "ref": {
          "tms": [
            {
              "idx": 1,
              "src": "A sheep finds a word.",
              "tgt": "A sheep finds a word.",
              "ratio": 75,
              "diff": "A<ins>nother</ins> sheep finds a <ins>similar </ins>word."
            }
          ],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 3,
        "src": "The sheep compare the words and choose the best one.",
        "pre": "",
        "tgt": "The sheep compare the words and choose the best one.",
        "status": 0,
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 4,
        "src": "A sheep spins wool.",
        "pre": "",
        "tgt": "A sheep spins wool.",
        "status": 0,
        "ref": {
          "tms": [
            {
              "idx": 1,
              "src": "A sheep finds a word.",
              "tgt": "A sheep finds a word.",
              "ratio": 75,
              "diff": "A sheep <del>f</del><ins>sp</ins>in<del>d</del>s<del> a</del> wo<del>rd</del><ins>ol</ins>."
            }
          ],
          "tb": [],
          "quoted": [
            [
              5,
              73
            ]
          ],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 5,
        "src": "Another sheep sells wool.",
        "pre": "",
        "tgt": "Another sheep sells wool.",
        "status": 0,
        "ref": {
          "tms": [
            {
              "idx": 4,
              "src": "A sheep spins wool.",
              "tgt": "A sheep spins wool.",
              "ratio": 73,
              "diff": "A<ins>nother</ins> sheep s<del>pin</del><ins>ell</ins>s wool."
            }
          ],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 6,
        "src": "The sheep share their stories with the world.",
        "pre": "",
        "tgt": "The sheep share their stories with the world.",
        "status": 0,
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 7,
        "src": "One sheep writes a story about wool.",
        "pre": "",
        "tgt": "One sheep writes a story about wool.",
        "status": 0,
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [
            [
              8,
              81
            ]
          ],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 8,
        "src": "Another sheep writes a story about sheep.",
        "pre": "",
        "tgt": "Another sheep writes a story about sheep.",
        "status": 0,
        "ref": {
          "tms": [
            {
              "idx": 7,
              "src": "One sheep writes a story about wool.",
              "tgt": "One sheep writes a story about wool.",
              "ratio": 81,
              "diff": "<del>O</del><ins>A</ins>n<ins>oth</ins>e<ins>r</ins> sheep writes a story about <del>wool</del><ins>sheep</ins>."
            }
          ],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 9,
        "src": "The stories are different, but some words are the same.",
        "pre": "",
        "tgt": "The stories are different, but some words are the same.",
        "status": 0,
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 10,
        "src": "{@0}On 1 June 2026{@1}, 100 sheep joined the story project.",
        "pre": "",
        "tgt": "{@2}On 1 June 2026{@3}, 100 sheep joined the story project.",
        "status": 0,
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [
            [
              12,
              95
            ],
            [
              11,
              97
            ]
          ],
          "quoted100": []
        },
        "placeholders": {
          "0": "<run1>",
          "1": "</run1>",
          "2": "<run1>",
          "3": "</run1>"
        }
      },
      {
        "idx": 11,
        "src": "{@0}On 15 June 2026{@1}, 120 sheep joined the story project.",
        "pre": "",
        "tgt": "{@2}On 15 June 2026{@3}, 120 sheep joined the story project.",
        "status": 0,
        "ref": {
          "tms": [
            {
              "idx": 10,
              "src": "{@0}On 1 June 2026{@1}, 100 sheep joined the story project.",
              "tgt": "{@2}On 1 June 2026{@3}, 100 sheep joined the story project.",
              "ratio": 97,
              "diff": "{@0}On 1<ins>5</ins> June 2026{@1}, 1<del>0</del><ins>2</ins>0 sheep joined the story project."
            }
          ],
          "tb": [],
          "quoted": [
            [
              12,
              94
            ]
          ],
          "quoted100": []
        },
        "placeholders": {
          "0": "<run1>",
          "1": "</run1>",
          "2": "<run1>",
          "3": "</run1>"
        }
      },
      {
        "idx": 12,
        "src": "{@0}On 1 July 2026{@1}, 150 sheep joined the story project.",
        "pre": "",
        "tgt": "{@2}On 1 July 2026{@3}, 150 sheep joined the story project.",
        "status": 0,
        "ref": {
          "tms": [
            {
              "idx": 10,
              "src": "{@0}On 1 June 2026{@1}, 100 sheep joined the story project.",
              "tgt": "{@2}On 1 June 2026{@3}, 100 sheep joined the story project.",
              "ratio": 95,
              "diff": "{@0}On 1 Ju<del>ne</del><ins>ly</ins> 2026{@1}, 1<del>0</del><ins>5</ins>0 sheep joined the story project."
            },
            {
              "idx": 11,
              "src": "{@0}On 15 June 2026{@1}, 120 sheep joined the story project.",
              "tgt": "{@2}On 15 June 2026{@3}, 120 sheep joined the story project.",
              "ratio": 94,
              "diff": "{@0}On 1<del>5</del> Ju<del>ne</del><ins>ly</ins> 2026{@1}, 1<del>2</del><ins>5</ins>0 sheep joined the story project."
            }
          ],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {
          "0": "<run1>",
          "1": "</run1>",
          "2": "<run1>",
          "3": "</run1>"
        }
      },
      {
        "idx": 13,
        "src": "A small farm has 100 sheep.",
        "pre": "",
        "tgt": "A small farm has 100 sheep.",
        "status": 0,
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [
            [
              14,
              82
            ]
          ],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 14,
        "src": "A large farm has 1,000 sheep.",
        "pre": "",
        "tgt": "A large farm has 1,000 sheep.",
        "status": 0,
        "ref": {
          "tms": [
            {
              "idx": 13,
              "src": "A small farm has 100 sheep.",
              "tgt": "A small farm has 100 sheep.",
              "ratio": 82,
              "diff": "A <del>sm</del><ins>l</ins>a<del>ll</del><ins>rge</ins> farm has 1<ins>,0</ins>00 sheep."
            }
          ],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 15,
        "src": "Both farms produce soft wool for many customers.",
        "pre": "",
        "tgt": "Both farms produce soft wool for many customers.",
        "status": 0,
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 16,
        "src": "Last month, we translated 10 stories about sheep.",
        "pre": "",
        "tgt": "Last month, we translated 10 stories about sheep.",
        "status": 0,
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [
            [
              18,
              79
            ],
            [
              17,
              82
            ]
          ],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 17,
        "src": "This month, we translated 12 stories about wool.",
        "pre": "",
        "tgt": "This month, we translated 12 stories about wool.",
        "status": 0,
        "ref": {
          "tms": [
            {
              "idx": 16,
              "src": "Last month, we translated 10 stories about sheep.",
              "tgt": "Last month, we translated 10 stories about sheep.",
              "ratio": 82,
              "diff": "<del>La</del><ins>Thi</ins>s<del>t</del> month, we translated 1<del>0</del><ins>2</ins> stories about <del>sheep</del><ins>wool</ins>."
            }
          ],
          "tb": [],
          "quoted": [
            [
              18,
              76
            ]
          ],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 18,
        "src": "Next month, we will translate 15 stories about sheep and wool.",
        "pre": "",
        "tgt": "Next month, we will translate 15 stories about sheep and wool.",
        "status": 0,
        "ref": {
          "tms": [
            {
              "idx": 16,
              "src": "Last month, we translated 10 stories about sheep.",
              "tgt": "Last month, we translated 10 stories about sheep.",
              "ratio": 79,
              "diff": "<del>Las</del><ins>Nex</ins>t month, we <ins>will </ins>translate<del>d</del> 1<del>0</del><ins>5</ins> stories about sheep<ins> and wool</ins>."
            },
            {
              "idx": 17,
              "src": "This month, we translated 12 stories about wool.",
              "tgt": "This month, we translated 12 stories about wool.",
              "ratio": 76,
              "diff": "<del>This</del><ins>Next</ins> month, we <ins>will </ins>translate<del>d</del> 1<del>2</del><ins>5</ins> stories about <ins>sheep and </ins>wool."
            }
          ],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 19,
        "src": "Translation memory remembers old translations.",
        "pre": "",
        "tgt": "Translation memory remembers old translations.",
        "status": 0,
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [
            [
              20,
              93
            ]
          ],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 20,
        "src": "Translation memory remembers useful translations.",
        "pre": "",
        "tgt": "Translation memory remembers useful translations.",
        "status": 0,
        "ref": {
          "tms": [
            {
              "idx": 19,
              "src": "Translation memory remembers old translations.",
              "tgt": "Translation memory remembers old translations.",
              "ratio": 93,
              "diff": "Translation memory remembers <del>o</del><ins>usefu</ins>l<del>d</del> translations."
            }
          ],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 21,
        "src": "Terminology helps every sheep use the same words.",
        "pre": "",
        "tgt": "Terminology helps every sheep use the same words.",
        "status": 0,
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 22,
        "src": "Together, the sheep work carefully.",
        "pre": "",
        "tgt": "Together, the sheep work carefully.",
        "status": 0,
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [
            [
              23,
              68
            ]
          ],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 23,
        "src": "Together, the sheep learn new words.",
        "pre": "",
        "tgt": "Together, the sheep learn new words.",
        "status": 0,
        "ref": {
          "tms": [
            {
              "idx": 22,
              "src": "Together, the sheep work carefully.",
              "tgt": "Together, the sheep work carefully.",
              "ratio": 68,
              "diff": "Together, the sheep <ins>learn new </ins>wor<del>k carefully</del><ins>ds</ins>."
            }
          ],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 24,
        "src": "Together, they make translation easier.",
        "pre": "",
        "tgt": "Together, they make translation easier.",
        "status": 0,
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 25,
        "src": "On 1 August 2026, the team reviewed 25 translated stories.",
        "pre": "",
        "tgt": "On 1 August 2026, the team reviewed 25 translated stories.",
        "status": 0,
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [
            [
              26,
              96
            ]
          ],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 26,
        "src": "On 15 August 2026, the team reviewed 30 translated stories.",
        "pre": "",
        "tgt": "On 15 August 2026, the team reviewed 30 translated stories.",
        "status": 0,
        "ref": {
          "tms": [
            {
              "idx": 25,
              "src": "On 1 August 2026, the team reviewed 25 translated stories.",
              "tgt": "On 1 August 2026, the team reviewed 25 translated stories.",
              "ratio": 96,
              "diff": "On 1<ins>5</ins> August 2026, the team reviewed <del>25</del><ins>30</ins> translated stories."
            }
          ],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 27,
        "src": "The team hopes to review 50 translated stories by 1 September 2026.",
        "pre": "",
        "tgt": "The team hopes to review 50 translated stories by 1 September 2026.",
        "status": 0,
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {}
      },
      {
        "idx": 28,
        "src": "sheep",
        "pre": "",
        "tgt": "sheep",
        "status": 0,
        "ref": {
          "tms": [],
          "tb": [],
          "quoted": [],
          "quoted100": []
        },
        "placeholders": {}
      }
    ],
    "terms": []
  },
  "projectInfo": {
    "version": 2,
    "projectName": "SheepWeaveSample",
    "sourceLanguage": "en-US",
    "targetLanguage": "ja-JP",
    "sourceFiles": [
      "SheepWeaveSample.docx"
    ],
    "okapi": [
      {
        "filter": "auto",
        "files": [
          {
            "source": "Working/02_SOURCE/SheepWeaveSample.docx",
            "xliff": "Working/03_XLF_JSON/SheepWeaveSample.docx.xlf",
            "status": "extracted"
          }
        ]
      }
    ]
  }
};
